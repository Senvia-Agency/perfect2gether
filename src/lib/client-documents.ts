import { z } from 'zod';

import type { EdpDocumentSide } from './edp/types';
import type { EdpDocumentVersion } from './edp/validation';

const UuidSchema = z.string().uuid();
const NullableDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const validatedOutput = <T>() => z.custom<T>();
const ClientDocumentCategorySchema = z.enum([
  'CC',
  'Comprovativo de morada',
  'CRC',
  'Fatura',
  'Outro',
]);

export type ClientDocumentCategory = z.infer<typeof ClientDocumentCategorySchema>;

export const CLIENT_DOCUMENT_CATEGORY_OPTIONS = [
  { value: 'CC', label: 'Cartão de cidadão (CC)' },
  { value: 'Comprovativo de morada', label: 'Comprovativo de morada' },
  { value: 'CRC', label: 'Certidão permanente (CRC)' },
  { value: 'Fatura', label: 'Fatura' },
  { value: 'Outro', label: 'Outro documento' },
] as const satisfies readonly { readonly value: ClientDocumentCategory; readonly label: string }[];

type ClientDocumentUploadMetadataInput = {
  readonly category: ClientDocumentCategory;
  readonly customLabel: string;
  readonly fileName: string;
  readonly side: EdpDocumentSide;
};

export function parseClientDocumentCategory(input: unknown): ClientDocumentCategory {
  return ClientDocumentCategorySchema.parse(input);
}

export function prepareClientDocumentUploadMetadata(
  input: ClientDocumentUploadMetadataInput,
): { readonly category: ClientDocumentCategory; readonly label: string; readonly side: EdpDocumentSide } {
  return {
    category: input.category,
    // O servidor aceita nomes até 200 caracteres; nomes de ficheiro maiores eram rejeitados.
    label: (input.customLabel.trim() || input.fileName.trim() || input.category).slice(0, 200),
    side: input.category === 'CC' ? input.side : 'single',
  };
}

type ClientDocumentRow = {
  readonly id: string;
  readonly client_id: string;
  readonly person_id: string | null;
  readonly category: string;
  readonly label: string;
  readonly archived_at: string | null;
  readonly created_at: string;
};

type ClientDocumentVersionRow = {
  readonly id: string;
  readonly document_id: string;
  readonly side: EdpDocumentSide;
  readonly original_name: string;
  readonly mime_type: 'application/pdf' | 'image/jpeg' | 'image/png';
  readonly size_bytes: number;
  readonly sha256: string;
  readonly validity_suggested_on: string | null;
  readonly validity_confirmed_on: string | null;
  readonly created_at: string;
};

export type ClientDocumentPerson = {
  readonly id: string;
  readonly name: string;
};

const ClientDocumentRowSchema = z.object({
  id: UuidSchema,
  client_id: UuidSchema,
  person_id: UuidSchema.nullable(),
  category: z.string().trim().min(1),
  label: z.string().trim().min(1),
  archived_at: z.string().nullable(),
  created_at: z.string(),
}).strict().pipe(validatedOutput<ClientDocumentRow>());

const ClientDocumentVersionRowSchema = z.object({
  id: UuidSchema,
  document_id: UuidSchema,
  side: z.enum(['single', 'front', 'back']),
  original_name: z.string().min(1),
  mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  size_bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  validity_suggested_on: NullableDateSchema,
  validity_confirmed_on: NullableDateSchema,
  created_at: z.string(),
}).strict().pipe(validatedOutput<ClientDocumentVersionRow>());

const ClientDocumentPersonSchema = z.object({
  id: UuidSchema,
  name: z.string().trim().min(1),
}).strict().pipe(validatedOutput<ClientDocumentPerson>());

const SIDE_LABELS = {
  single: 'Documento único',
  front: 'Frente',
  back: 'Verso',
} as const satisfies Record<EdpDocumentSide, string>;

export type ClientDocumentArchiveItem = {
  readonly documentId: string;
  readonly clientId: string;
  readonly personId: string | null;
  readonly personName: string | null;
  readonly category: string;
  readonly label: string;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly versions: readonly EdpDocumentVersion[];
};

export type ClientDocumentValidity =
  | { readonly kind: 'confirmed'; readonly date: string }
  | { readonly kind: 'suggested'; readonly date: string }
  | { readonly kind: 'unknown'; readonly date: null };

export function parseClientDocumentArchive(
  documentInput: unknown,
  versionInput: unknown,
  peopleInput: unknown,
): readonly ClientDocumentArchiveItem[] {
  const documents = z.array(ClientDocumentRowSchema).parse(documentInput);
  const versionRows = z.array(ClientDocumentVersionRowSchema).parse(versionInput);
  const people = parseClientDocumentPeople(peopleInput);
  const peopleById = new Map(people.map((person) => [person.id, person.name]));
  const versionsByDocument = new Map<string, EdpDocumentVersion[]>();
  const documentsById = new Map(documents.map((document) => [document.id, document]));

  for (const row of versionRows) {
    const document = documentsById.get(row.document_id);
    if (!document) continue;
    const version: EdpDocumentVersion = {
      document_id: row.document_id,
      version_id: row.id,
      person_id: document.person_id,
      category: document.category,
      label: document.label,
      side: row.side,
      original_name: row.original_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      sha256: row.sha256,
      validity_suggested_on: row.validity_suggested_on,
      validity_confirmed_on: row.validity_confirmed_on,
      created_at: row.created_at,
    };
    const grouped = versionsByDocument.get(row.document_id) ?? [];
    grouped.push(version);
    versionsByDocument.set(row.document_id, grouped);
  }

  return [...documents]
    .sort((left, right) => {
      if (left.archived_at === null && right.archived_at !== null) return -1;
      if (left.archived_at !== null && right.archived_at === null) return 1;
      return right.created_at.localeCompare(left.created_at);
    })
    .map((document) => ({
      documentId: document.id,
      clientId: document.client_id,
      personId: document.person_id,
      personName: document.person_id ? peopleById.get(document.person_id) ?? null : null,
      category: document.category,
      label: document.label,
      archivedAt: document.archived_at,
      createdAt: document.created_at,
      versions: [...(versionsByDocument.get(document.id) ?? [])]
        .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    }));
}

export function parseClientDocumentPeople(input: unknown): readonly ClientDocumentPerson[] {
  return z.array(ClientDocumentPersonSchema).parse(input);
}

export function clientDocumentValidity(version: Pick<
  EdpDocumentVersion,
  'validity_confirmed_on' | 'validity_suggested_on'
>): ClientDocumentValidity {
  if (version.validity_confirmed_on) return { kind: 'confirmed', date: version.validity_confirmed_on };
  if (version.validity_suggested_on) return { kind: 'suggested', date: version.validity_suggested_on };
  return { kind: 'unknown', date: null };
}

export function clientDocumentSideLabel(side: EdpDocumentSide): string {
  return SIDE_LABELS[side];
}

export const REQUIRED_CLIENT_DOCUMENT_CATEGORIES = ['CC', 'Comprovativo de morada', 'CRC', 'Fatura'] as const satisfies readonly ClientDocumentCategory[];
export type RequiredClientDocumentCategory = (typeof REQUIRED_CLIENT_DOCUMENT_CATEGORIES)[number];

export type ClientDocumentDateStatus = 'valid' | 'expiring' | 'expired' | 'unknown';
export type ClientDocumentRequirementStatus = ClientDocumentDateStatus | 'missing' | 'partial';

export type ClientDocumentRequirement = {
  readonly category: RequiredClientDocumentCategory;
  readonly status: ClientDocumentRequirementStatus;
  readonly document: ClientDocumentArchiveItem | null;
  readonly version: EdpDocumentVersion | null;
  readonly validUntil: string | null;
  readonly missingSide: 'front' | 'back' | null;
};

const EXPIRING_WINDOW_DAYS = 30;

export function lisbonToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function clientDocumentDateStatus(validUntil: string | null, today: string): ClientDocumentDateStatus {
  if (!validUntil) return 'unknown';
  if (validUntil < today) return 'expired';
  if (validUntil <= addDays(today, EXPIRING_WINDOW_DAYS)) return 'expiring';
  return 'valid';
}

/** Estado de um documento obrigatório, a partir da versão mais recente dos documentos ativos dessa categoria. */
export function summarizeClientDocumentRequirement(
  category: RequiredClientDocumentCategory,
  documents: readonly ClientDocumentArchiveItem[],
  today: string,
): ClientDocumentRequirement {
  const candidates = documents
    .filter((item) => !item.archivedAt && item.category === category)
    .flatMap((item) => item.versions.map((version) => ({ item, version })))
    .sort((left, right) => right.version.created_at.localeCompare(left.version.created_at));
  const latest = candidates[0];
  if (!latest) return { category, status: 'missing', document: null, version: null, validUntil: null, missingSide: null };

  let missingSide: 'front' | 'back' | null = null;
  let current = [latest];
  if (category === 'CC') {
    // O cartão é de uma pessoa: só contam as faces dessa pessoa, e uma face antiga não completa um cartão novo.
    const owned = candidates.filter(({ item }) => item.personId === latest.item.personId);
    const single = owned.find(({ version }) => version.side === 'single');
    const newerThanSingle = (side: EdpDocumentSide) =>
      owned.find(({ version }) => version.side === side && (!single || version.created_at > single.version.created_at));
    const front = newerThanSingle('front');
    const back = newerThanSingle('back');
    if (front || back) {
      missingSide = !front ? 'front' : !back ? 'back' : null;
      current = [front, back].filter((candidate) => candidate !== undefined);
    }
  }
  // A data sugerida só é fiável onde a única data futura impressa é a validade (CC, certidão);
  // numa fatura costuma ser o prazo de pagamento.
  const trustsSuggestion = category === 'CC' || category === 'CRC';
  const validUntil = current
    .map(({ version }) => (trustsSuggestion ? clientDocumentValidity(version).date : version.validity_confirmed_on))
    .find((date) => date !== null) ?? null;
  return {
    category,
    status: missingSide ? 'partial' : clientDocumentDateStatus(validUntil, today),
    document: latest.item,
    version: latest.version,
    validUntil,
    missingSide,
  };
}
