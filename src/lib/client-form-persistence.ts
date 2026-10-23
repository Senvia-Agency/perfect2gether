import { z } from 'zod';
import { certificateSchema, CRC_PATTERN } from './client-certificate';

export const CLIENT_FORM_STORAGE_TTL_MS = 24 * 60 * 60 * 1_000;

const STORAGE_ERROR_MESSAGE = 'O armazenamento local está indisponível. Ative-o para guardar o rascunho e importar a certidão em segurança.';
const DRAFT_KEY_PREFIX = 'p2g-client-form-draft-v1';
const RECOVERY_KEY_PREFIX = 'p2g-client-certificate-recovery-v1';

const clientFormScopeSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  formContext: z.union([
    z.literal('create'),
    z.string().regex(/^edit:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  ]),
}).required();

export type ClientFormScope = z.infer<typeof clientFormScopeSchema>;

const decisionMakerSchema = z.object({
  name: z.string(),
  role: z.string(),
  phone: z.string(),
  email: z.string(),
}).required();

export const clientFormDraftSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  company: z.string(),
  nif: z.string(),
  decisionMakers: z.array(decisionMakerSchema),
  companyNif: z.string(),
  crcCode: z.string(),
  certificateData: certificateSchema.nullable(),
  certificateCheckedAt: z.string().datetime({ offset: true }).nullable(),
  billingTarget: z.enum(['client', 'company']),
  status: z.enum(['active', 'inactive', 'vip']),
  source: z.string(),
  notes: z.string(),
  assignedTo: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string(),
  distrito: z.string(),
  conselho: z.string(),
  grupoEconomico: z.string(),
}).required();

export type ClientFormDraft = z.infer<typeof clientFormDraftSchema>;

export const certificateRecoverySchema = z.object({
  requestId: z.string().uuid(),
  crcCode: z.string().regex(CRC_PATTERN),
  runId: z.string().min(1).optional(),
  startedAt: z.string().datetime({ offset: true }),
  phase: z.enum(['QUEUED', 'EXTRACTING']),
}).required({ requestId: true, crcCode: true, startedAt: true, phase: true });

export type CertificateRecovery = z.infer<typeof certificateRecoverySchema>;

type Ready<T> = { readonly kind: 'ready'; readonly value: T | null };
type StorageUnavailable = { readonly kind: 'unavailable'; readonly message: string };
export type StorageReadResult<T> = Ready<T> | StorageUnavailable;
export type StorageWriteResult = { readonly kind: 'ready' } | StorageUnavailable;

export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const draftEnvelopeSchema = z.object({
  scope: clientFormScopeSchema,
  savedAt: z.number().int().nonnegative(),
  value: clientFormDraftSchema,
}).required();

const recoveryEnvelopeSchema = z.object({
  scope: clientFormScopeSchema,
  createdAt: z.number().int().nonnegative(),
  savedAt: z.number().int().nonnegative(),
  value: certificateRecoverySchema,
}).required();

function scopePart(scope: ClientFormScope): string {
  return [scope.userId, scope.organizationId, scope.formContext].map(encodeURIComponent).join(':');
}

function sameScope(left: ClientFormScope, right: ClientFormScope): boolean {
  return left.userId === right.userId
    && left.organizationId === right.organizationId
    && left.formContext === right.formContext;
}

function unavailable(): StorageUnavailable {
  return { kind: 'unavailable', message: STORAGE_ERROR_MESSAGE };
}

function readUnknown(storage: BrowserStorage, key: string): StorageReadResult<unknown> {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { kind: 'ready', value: null };
    return { kind: 'ready', value: JSON.parse(raw) };
  } catch (error) {
    if (error instanceof Error) return unavailable();
    return unavailable();
  }
}

function remove(storage: BrowserStorage, key: string): StorageWriteResult {
  try {
    storage.removeItem(key);
    return { kind: 'ready' };
  } catch (error) {
    if (error instanceof Error) return unavailable();
    return unavailable();
  }
}

function write(storage: BrowserStorage, key: string, value: unknown): StorageWriteResult {
  try {
    storage.setItem(key, JSON.stringify(value));
    return { kind: 'ready' };
  } catch (error) {
    if (error instanceof Error) return unavailable();
    return unavailable();
  }
}

export function clientFormDraftStorageKey(scope: ClientFormScope): string {
  return `${DRAFT_KEY_PREFIX}:${scopePart(scope)}`;
}

export function certificateRecoveryStorageKey(scope: ClientFormScope): string {
  return `${RECOVERY_KEY_PREFIX}:${scopePart(scope)}`;
}

export function loadClientFormDraft(
  storage: BrowserStorage,
  scope: ClientFormScope,
  now = Date.now(),
): StorageReadResult<ClientFormDraft> {
  const key = clientFormDraftStorageKey(scope);
  const stored = readUnknown(storage, key);
  if (stored.kind === 'unavailable' || stored.value === null) return stored;
  const parsed = draftEnvelopeSchema.safeParse(stored.value);
  if (!parsed.success || !sameScope(parsed.data.scope, scope) || now - parsed.data.savedAt > CLIENT_FORM_STORAGE_TTL_MS) {
    const removed = remove(storage, key);
    return removed.kind === 'unavailable' ? removed : { kind: 'ready', value: null };
  }
  return { kind: 'ready', value: parsed.data.value };
}

export function saveClientFormDraft(
  storage: BrowserStorage,
  scope: ClientFormScope,
  value: ClientFormDraft,
  now = Date.now(),
): StorageWriteResult {
  const parsedScope = clientFormScopeSchema.safeParse(scope);
  const parsedValue = clientFormDraftSchema.safeParse(value);
  if (!parsedScope.success || !parsedValue.success) return unavailable();
  return write(storage, clientFormDraftStorageKey(scope), { scope, savedAt: now, value: parsedValue.data });
}

export function clearClientFormDraft(storage: BrowserStorage, scope: ClientFormScope): StorageWriteResult {
  return remove(storage, clientFormDraftStorageKey(scope));
}

export function loadCertificateRecovery(
  storage: BrowserStorage,
  scope: ClientFormScope,
  crcCode: string,
  now = Date.now(),
): StorageReadResult<CertificateRecovery> {
  const key = certificateRecoveryStorageKey(scope);
  const stored = readUnknown(storage, key);
  if (stored.kind === 'unavailable' || stored.value === null) return stored;
  const parsed = recoveryEnvelopeSchema.safeParse(stored.value);
  if (!parsed.success
    || !sameScope(parsed.data.scope, scope)
    || now - parsed.data.createdAt > CLIENT_FORM_STORAGE_TTL_MS) {
    const removed = remove(storage, key);
    return removed.kind === 'unavailable' ? removed : { kind: 'ready', value: null };
  }
  if (parsed.data.value.crcCode !== crcCode.trim()) return { kind: 'ready', value: null };
  return { kind: 'ready', value: parsed.data.value };
}

export function saveCertificateRecovery(
  storage: BrowserStorage,
  scope: ClientFormScope,
  value: CertificateRecovery,
  now = Date.now(),
): StorageWriteResult {
  const parsedScope = clientFormScopeSchema.safeParse(scope);
  const parsedValue = certificateRecoverySchema.safeParse(value);
  if (!parsedScope.success || !parsedValue.success) return unavailable();
  const key = certificateRecoveryStorageKey(scope);
  const stored = readUnknown(storage, key);
  if (stored.kind === 'unavailable') return stored;
  const previous = recoveryEnvelopeSchema.safeParse(stored.value);
  const createdAt = previous.success && sameScope(previous.data.scope, scope)
    ? previous.data.createdAt
    : now;
  return write(storage, key, { scope, createdAt, savedAt: now, value: parsedValue.data });
}

export function clearCertificateRecovery(
  storage: BrowserStorage,
  scope: ClientFormScope,
  crcCode: string,
): StorageWriteResult {
  const key = certificateRecoveryStorageKey(scope);
  const stored = loadCertificateRecovery(storage, scope, crcCode);
  if (stored.kind === 'unavailable') return stored;
  return stored.value === null ? { kind: 'ready' } : remove(storage, key);
}

export function clearCertificateRecoveries(
  storage: BrowserStorage,
  scope: ClientFormScope,
): StorageWriteResult {
  return remove(storage, certificateRecoveryStorageKey(scope));
}
