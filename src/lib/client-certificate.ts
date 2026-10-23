import { z } from 'zod';

export const CRC_PATTERN = /^\d{4}-\d{4}-\d{4}$/;
export const certificateSchema = z.object({
  nipc: z.string().regex(/^\d{9}$/),
  denominacao: z.string().trim().min(1),
  cae: z.array(z.object({ codigo: z.string().min(1), descricao: z.string(), principal: z.boolean() })),
  gerentes: z.array(z.object({ nome: z.string().min(1), nif: z.string().nullable().optional() })),
  ok: z.literal(true),
  erro: z.string().nullable().optional(),
});
export type ClientCertificate = z.infer<typeof certificateSchema>;
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

export function certificateRequired(isP2g: boolean) {
  return isP2g;
}


type CertificateIdentity = { readonly name: string; readonly company: string; readonly companyNif: string };
export function clearCertificateIdentity(identity: CertificateIdentity, certificate: ClientCertificate): CertificateIdentity {
  return {
    name: identity.name === certificate.denominacao ? '' : identity.name,
    company: identity.company === certificate.denominacao ? '' : identity.company,
    companyNif: identity.companyNif === certificate.nipc ? '' : identity.companyNif,
  };
}
