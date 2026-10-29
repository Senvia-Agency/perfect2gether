import { z } from 'zod';
import type { Json } from '@/integrations/supabase/types';

export const CRC_PATTERN = /^\d{4}-\d{4}-\d{4}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isJson(value: unknown): value is Json {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value !== 'object') return false;
  return Object.values(value).every(item => item === undefined || isJson(item));
}

export const jsonValueSchema = z.custom<Json>(isJson);
export const certificateSchema = z.object({
  nipc: z.string().regex(/^\d{9}$/),
  denominacao: z.string().trim().min(1),
  cae: z.array(z.object({ codigo: z.string().min(1), descricao: z.string(), principal: z.boolean() })),
  gerentes: z.array(z.object({ nome: z.string().min(1), nif: z.string().nullable().optional() })),
  ok: z.literal(true),
  erro: z.string().nullable().optional(),
});
export type ClientCertificate = z.infer<typeof certificateSchema>;
export type ClientCertificateRenewalTarget = {
  readonly id: string;
  readonly name: string;
};

export const clientCertificateHistoryRowSchema = z.object({
  version_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  crc_code: z.string().regex(CRC_PATTERN).nullable(),
  certificate_data: jsonValueSchema.nullable(),
  valid_from: z.string().regex(ISO_DATE_PATTERN).nullable(),
  valid_until: z.string().regex(ISO_DATE_PATTERN).nullable(),
  source: z.enum(['legacy', 'manual', 'crc_lookup']),
  source_metadata: jsonValueSchema,
  recorded_by: z.string().uuid().nullable(),
  recorded_at: z.string().datetime({ offset: true }),
  is_current: z.boolean(),
});
export type ClientCertificateHistoryRow = z.infer<typeof clientCertificateHistoryRowSchema>;
export type ClientCertificateValidity = 'valid' | 'expired' | 'unknown';

const caeSchema = z.object({
  principal: z.string().trim().min(1),
  secundarios: z.array(z.string().trim().min(1)),
});
const clientOriginSchema = z.object({
  lead_id: z.string().uuid(),
  lead_source: z.string().trim().min(1).optional(),
  prospect_id: z.string().uuid().optional(),
  source_file_name: z.string().trim().min(1).optional(),
  source_portal: z.string().trim().min(1).optional(),
  publication_date: z.string().regex(ISO_DATE_PATTERN).optional(),
});
export const clientSourceMetadataSchema = z.object({
  lead_source: z.string().trim().min(1).optional(),
  prospect_id: z.string().uuid().optional(),
  source_file_name: z.string().trim().min(1).optional(),
  source_portal: z.string().trim().min(1).optional(),
  publication_date: z.string().regex(ISO_DATE_PATTERN).optional(),
  cae: caeSchema.optional(),
  cae_source: z.string().trim().min(1).optional(),
  cae_review: z.object({
    incoming: caeSchema,
    source_portal: z.string().trim().min(1).optional(),
    publication_date: z.string().regex(ISO_DATE_PATTERN).optional(),
    lead_id: z.string().uuid().optional(),
  }).optional(),
  origins: z.array(clientOriginSchema).optional(),
}).passthrough();
export type ClientSourceMetadata = z.infer<typeof clientSourceMetadataSchema>;
export const certificateImportPhaseSchema = z.enum(['QUEUED', 'EXTRACTING']);
export type CertificateImportPhase = z.infer<typeof certificateImportPhaseSchema>;

export const certificateResponseSchema = z.discriminatedUnion('status', [
  z.object({
    runId: z.string().min(1),
    status: z.literal('RUNNING'),
    phase: certificateImportPhaseSchema,
    startedAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    runId: z.string().min(1).optional(),
    status: z.literal('SUCCEEDED'),
    data: z.unknown(),
    checkedAt: z.string().datetime({ offset: true }),
    cached: z.boolean(),
  }),
  z.object({
    runId: z.string().min(1).optional(),
    status: z.literal('FAILED'),
    error: z.string().min(1),
  }),
]);

const invocationErrorSchema = z.object({
  context: z.object({ status: z.number().int() }).passthrough().optional(),
}).passthrough();

export type CertificateInvocationErrorKind = 'AUTH' | 'TRANSIENT' | 'UNKNOWN';

export function classifyCertificateInvocationError(value: unknown): CertificateInvocationErrorKind {
  const parsed = invocationErrorSchema.safeParse(value);
  const status = parsed.success ? parsed.data.context?.status : undefined;
  if (status === 401 || status === 403) return 'AUTH';
  if (status === undefined || status === 408 || status === 429 || status >= 500) return 'TRANSIENT';
  return 'UNKNOWN';
}

export function formatCertificateElapsed(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1_000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes} min ${remainingSeconds} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

export function parseStoredCertificate(value: unknown): ClientCertificate | null {
  const result = certificateSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseCertificateHistory(value: unknown): ClientCertificateHistoryRow[] {
  return z.array(clientCertificateHistoryRowSchema).parse(value);
}

export function parseClientSourceMetadata(value: unknown): ClientSourceMetadata | null {
  const result = clientSourceMetadataSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function certificateValidity(
  validUntil: string | null,
  todayIsoDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' }),
): ClientCertificateValidity {
  if (!validUntil || !ISO_DATE_PATTERN.test(validUntil) || !ISO_DATE_PATTERN.test(todayIsoDate)) return 'unknown';
  return validUntil < todayIsoDate ? 'expired' : 'valid';
}

export function certificateRequired(_isP2g: boolean): boolean {
  return false;
}


type CertificateIdentity = { readonly name: string; readonly company: string; readonly companyNif: string };
export function clearCertificateIdentity(identity: CertificateIdentity, certificate: ClientCertificate): CertificateIdentity {
  return {
    name: identity.name === certificate.denominacao ? '' : identity.name,
    company: identity.company === certificate.denominacao ? '' : identity.company,
    companyNif: identity.companyNif === certificate.nipc ? '' : identity.companyNif,
  };
}
