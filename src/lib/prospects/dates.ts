import type { Prospect } from '@/types/prospects';

export type ProspectDateRange = { readonly from: string; readonly to: string };
export type ProspectOpeningDate = { readonly date: string | null; readonly publication: boolean };
const lisbonDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' });

export function calendarDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${value.trim()}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.trim() ? value.trim() : null;
}

export function prospectImportDate(value: string): string | null {
  const dateOnly = calendarDate(value);
  if (dateOnly) return dateOnly;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? lisbonDate.format(date) : null;
}

export function prospectOpeningDate(prospect: Pick<Prospect, 'metadata'>): ProspectOpeningDate {
  const metadata = prospect.metadata;
  for (const key of ['opening_date', 'incorporation_date', 'data_abertura']) {
    const date = calendarDate(metadata?.[key]);
    if (date) return { date, publication: false };
  }
  const constitution = typeof metadata?.acto === 'string' && /constitui[cç][aã]o/i.test(metadata.acto);
  return { date: metadata?.source_portal === 'publicacoes.mj.pt' && constitution ? calendarDate(metadata.publication_date) : null, publication: true };
}

export function matchesProspectDateRange(date: string | null, range: ProspectDateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!date || (range.from && range.to && range.from > range.to)) return false;
  return (!range.from || date >= range.from) && (!range.to || date <= range.to);
}

export function formatProspectDate(date: string | null): string {
  return date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : '—';
}
