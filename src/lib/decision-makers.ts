import type { Json } from '@/integrations/supabase/types';
import { z } from 'zod';

export const CLIENT_PERSON_SOURCES = ['legacy', 'manual', 'mj', 'crc_lookup'] as const;
export type ClientPersonSource = typeof CLIENT_PERSON_SOURCES[number];
type ClientPersonProvenance = {
  readonly source?: ClientPersonSource; readonly sourceRef?: string | null;
  readonly sourceMetadata?: Readonly<Record<string, Json>>; readonly roleSource?: ClientPersonSource;
};
export type DecisionMaker = {
  readonly id?: string; readonly name: string; readonly role: string;
  readonly nif?: string | null; readonly phone: string; readonly email: string;
} & ClientPersonProvenance;
export type LegalManager = {
  readonly id?: string; readonly name: string; readonly nif?: string | null;
  readonly phone: string; readonly email: string;
} & ClientPersonProvenance;
export type ClientPersonRolePayload = {
  readonly id?: string; readonly name: string; readonly nif: string | null;
  readonly phone: string | null; readonly email: string | null; readonly source: ClientPersonSource;
  readonly source_ref: string | null;
  readonly source_metadata: Readonly<Record<string, Json>>;
  readonly roles: readonly ('decision_maker' | 'legal_manager')[];
  readonly role_sources: Readonly<Partial<Record<'decision_maker' | 'legal_manager', ClientPersonSource>>>;
};

function isJson(value: unknown): value is Json {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value !== 'object') return false;
  return Object.values(value).every(item => item === undefined || isJson(item));
}

function isJsonRecord(value: unknown): value is Readonly<Record<string, Json>> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && isJson(value);
}

export const clientPersonRoleRowSchema = z.object({
  person_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  name: z.string().trim().min(1),
  nif: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  person_source: z.enum(CLIENT_PERSON_SOURCES),
  source_ref: z.string().nullable(),
  source_metadata: z.custom<Readonly<Record<string, Json>>>(isJsonRecord),
  role: z.enum(['decision_maker', 'legal_manager', 'shareholder']),
  role_source: z.enum(CLIENT_PERSON_SOURCES),
  is_complete: z.boolean(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
export type ClientPersonRoleRow = z.infer<typeof clientPersonRoleRowSchema>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyDecisionMaker(): DecisionMaker {
  return { name: '', role: '', phone: '', email: '' };
}

export function emptyLegalManager(): LegalManager {
  return { name: '', nif: null, phone: '', email: '', source: 'manual' };
}

function text(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

export function parseDecisionMakers(value: Json | null | undefined, legacyName?: string | null): DecisionMaker[] {
  const list = Array.isArray(value) ? value : [];
  const parsed = list.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    return [{
      name: text(item.name),
      role: text(item.role),
      nif: text(item.nif) || null,
      phone: text(item.phone),
      email: text(item.email),
      source: 'legacy' as const,
    }];
  });
  if (parsed.length === 0 && legacyName?.trim()) return [{ ...emptyDecisionMaker(), name: legacyName.trim() }];
  return parsed;
}

export function isDecisionMakerEmailValid(email: string): boolean {
  return !email.trim() || EMAIL_PATTERN.test(email.trim());
}

export function isDecisionMakerComplete(item: DecisionMaker): boolean {
  return !!item.name.trim()
    && !!item.phone.trim()
    && EMAIL_PATTERN.test(item.email.trim());
}

export function areDecisionMakersValid(list: DecisionMaker[]): boolean {
  return list.length > 0 && list.every(isDecisionMakerComplete);
}

function sameDecisionMaker(left: DecisionMaker, right: DecisionMaker): boolean {
  return left.name.trim() === right.name.trim()
    && left.role.trim() === right.role.trim()
    && normalizeNif(left.nif) === normalizeNif(right.nif)
    && left.phone.trim() === right.phone.trim()
    && left.email.trim().toLowerCase() === right.email.trim().toLowerCase();
}

export function isUnchangedLegacyDecisionMaker(
  item: DecisionMaker,
  index: number,
  original: readonly DecisionMaker[],
): boolean {
  const baseline = item.id
    ? original.find(candidate => candidate.id === item.id)
    : original[index];
  return !!baseline
    && (baseline.source === 'legacy' || !!baseline.id)
    && !isDecisionMakerComplete(baseline)
    && sameDecisionMaker(item, baseline);
}

export function areDecisionMakerChangesValid(
  list: readonly DecisionMaker[],
  original: readonly DecisionMaker[],
): boolean {
  return list.length > 0 && list.every((item, index) => (
    isDecisionMakerComplete(item)
    || isUnchangedLegacyDecisionMaker(item, index, original)
  ));
}

export function areLegalManagersValid(list: readonly LegalManager[]): boolean {
  return list.every(item => !!item.name.trim() && isDecisionMakerEmailValid(item.email));
}

export function decisionMakersPayload(list: DecisionMaker[]): { decision_makers: DecisionMaker[]; decision_maker_name: string } {
  const decisionMakers = list.map(item => ({ name: item.name.trim(), role: item.role.trim(), phone: item.phone.trim(), email: item.email.trim() }));
  return { decision_makers: decisionMakers, decision_maker_name: decisionMakers[0]?.name ?? '' };
}

export function parseClientPersonRoleRows(value: unknown): ClientPersonRoleRow[] {
  return z.array(clientPersonRoleRowSchema).parse(value);
}

export function decisionMakersFromRows(rows: readonly ClientPersonRoleRow[]): DecisionMaker[] {
  return rows.filter(row => row.role === 'decision_maker').map(row => ({
    id: row.person_id,
    name: row.name,
    role: typeof row.source_metadata.role === 'string' ? row.source_metadata.role : '',
    nif: row.nif,
    phone: row.phone ?? '',
    email: row.email ?? '',
    source: row.person_source,
    sourceRef: row.source_ref,
    sourceMetadata: row.source_metadata,
    roleSource: row.role_source,
  }));
}

export function legalManagersFromRows(rows: readonly ClientPersonRoleRow[]): LegalManager[] {
  return rows.filter(row => row.role === 'legal_manager').map(row => ({
    id: row.person_id,
    name: row.name,
    nif: row.nif,
    phone: row.phone ?? '',
    email: row.email ?? '',
    source: row.person_source,
    sourceRef: row.source_ref,
    sourceMetadata: row.source_metadata,
    roleSource: row.role_source,
  }));
}

export function mergeCertificateLegalManagers(
  current: readonly LegalManager[],
  certificateManagers: readonly { readonly nome?: string | null; readonly nif?: string | null }[],
): LegalManager[] {
  const result = [...current];
  for (const manager of certificateManagers) {
    const name = manager.nome?.trim();
    if (!name) continue;
    const nif = normalizeNif(manager.nif);
    if (nif && result.some(item => normalizeNif(item.nif) === nif)) continue;
    result.push({
      name,
      nif,
      phone: '',
      email: '',
      source: 'crc_lookup',
      roleSource: 'crc_lookup',
    });
  }
  return result;
}

function normalizeNif(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\D/g, '') ?? '';
  return normalized || null;
}

function sameFiscalPerson(
  left: Pick<DecisionMaker, 'id' | 'nif'>,
  right: Pick<LegalManager, 'id' | 'nif'>,
): boolean {
  if (left.id && right.id) return left.id === right.id;
  const leftNif = normalizeNif(left.nif);
  const rightNif = normalizeNif(right.nif);
  return !!leftNif && leftNif === rightNif;
}

export function hasClientPeopleContactConflict(
  decisionMakers: readonly DecisionMaker[],
  legalManagers: readonly LegalManager[],
): boolean {
  return decisionMakers.some(decisionMaker => legalManagers.some(legalManager => {
    if (!sameFiscalPerson(decisionMaker, legalManager)) return false;
    return [
      [decisionMaker.name, legalManager.name],
      [decisionMaker.phone, legalManager.phone],
      [decisionMaker.email.toLowerCase(), legalManager.email.toLowerCase()],
    ].some(([left, right]) => !!left.trim() && !!right.trim() && left.trim() !== right.trim());
  }));
}

export function buildClientPeoplePayload(
  decisionMakers: readonly DecisionMaker[],
  legalManagers: readonly LegalManager[],
): ClientPersonRolePayload[] {
  const payload: ClientPersonRolePayload[] = [];

  const add = (
    person: DecisionMaker | LegalManager,
    role: 'decision_maker' | 'legal_manager',
    roleTitle: string,
  ) => {
    const normalizedNif = normalizeNif(person.nif);
    const matchIndex = payload.findIndex(item => (
      (person.id && item.id === person.id)
      || (!!normalizedNif && item.nif === normalizedNif)
    ));
    const match = payload[matchIndex];
    const roleSource = person.roleSource ?? person.source ?? 'manual';
    if (match) {
      payload[matchIndex] = {
        ...match,
        source_metadata: roleTitle
          ? { ...match.source_metadata, role: roleTitle }
          : match.source_metadata,
        roles: match.roles.includes(role) ? match.roles : [...match.roles, role],
        role_sources: { ...match.role_sources, [role]: roleSource },
      };
      return;
    }
    payload.push({
      ...(person.id ? { id: person.id } : {}),
      name: person.name.trim(),
      nif: normalizedNif,
      phone: person.phone.trim() || null,
      email: person.email.trim().toLowerCase() || null,
      source: person.source ?? 'manual',
      source_ref: person.sourceRef ?? null,
      source_metadata: roleTitle
        ? { ...person.sourceMetadata, role: roleTitle }
        : person.sourceMetadata ?? {},
      roles: [role],
      role_sources: { [role]: roleSource },
    });
  };

  decisionMakers.forEach(item => add(item, 'decision_maker', item.role.trim()));
  legalManagers.forEach(item => add(item, 'legal_manager', ''));
  return payload;
}
