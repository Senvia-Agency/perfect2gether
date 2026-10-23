import { useMemo, useState } from 'react';
import { z } from 'zod';
import type { Prospect } from '@/types/prospects';
import { prospectImportDate, prospectOpeningDate } from '@/lib/prospects/dates';
import { mjLocation, readMjCompanyData } from '@/lib/prospects/mj-metadata';

const sortSchema = z.object({
  field: z.enum(['company', 'nif', 'location', 'imported', 'opening', 'contact', 'salesperson', 'status', 'segment']),
  direction: z.enum(['asc', 'desc']),
});
export type ProspectSort = z.infer<typeof sortSchema>;
export type ProspectSortField = ProspectSort['field'];
const defaultSort: ProspectSort = { field: 'imported', direction: 'desc' };
const collator = new Intl.Collator('pt-PT', { numeric: true, sensitivity: 'base' });

function readSort(key: string | null): ProspectSort {
  if (!key) return defaultSort;
  try {
    const result = sortSchema.safeParse(JSON.parse(localStorage.getItem(key) || 'null'));
    return result.success ? result.data : defaultSort;
  } catch (error) {
    if (error instanceof Error) return defaultSort;
    throw error;
  }
}

export function useProspectSort(prospects: readonly Prospect[], salespeople: ReadonlyMap<string, string>, userId?: string, organizationId?: string) {
  const key = userId && organizationId ? `p2g:prospects:sort:${organizationId}:${userId}` : null;
  const saved = useMemo(() => readSort(key), [key]);
  const [choice, setChoice] = useState<{ readonly key: string | null; readonly sort: ProspectSort } | null>(null);
  const sort = choice?.key === key ? choice.sort : saved;
  const toggle = (field: ProspectSortField) => {
    const next: ProspectSort = { field, direction: sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc' };
    setChoice({ key, sort: next });
    if (key) {
      try { localStorage.setItem(key, JSON.stringify(next)); }
      catch (error) {
        if (error instanceof Error) console.warn('Não foi possível guardar a ordenação dos prospects.');
        else throw error;
      }
    }
  };
  const sorted = useMemo(() => {
    const value = (prospect: Prospect): string | null => {
      const mj = readMjCompanyData(prospect.metadata);
      const values: Record<ProspectSortField, string | null> = {
        company: prospect.company_name,
        nif: prospect.nif,
        location: mj ? mjLocation(mj) || null : null,
        imported: prospectImportDate(prospect.imported_at),
        opening: prospectOpeningDate(prospect).date,
        contact: [prospect.contact_name, prospect.phone || prospect.email].filter(Boolean).join(' · ') || null,
        salesperson: salespeople.get(prospect.assigned_to || '') || 'Não atribuído',
        status: prospect.converted_to_lead ? 'Convertido' : prospect.assigned_to ? 'Atribuído' : 'Por distribuir',
        segment: prospect.segment,
      };
      return values[sort.field];
    };
    return [...prospects].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (!left || !right) return left ? -1 : right ? 1 : a.id.localeCompare(b.id);
      const result = collator.compare(left, right);
      return (sort.direction === 'asc' ? result : -result) || a.id.localeCompare(b.id);
    });
  }, [prospects, salespeople, sort]);
  return { sort, toggle, sorted };
}
