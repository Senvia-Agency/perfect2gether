import { useMemo, useState } from 'react';
import type { Prospect } from '@/types/prospects';
import { readMjCompanyData } from '@/lib/prospects/mj-metadata';
import { normalizeString } from '@/lib/utils';

export function useProspectCompanyFilters(prospects: readonly Prospect[]) {
  const [district, setDistrict] = useState<string[]>([]);
  const [municipality, setMunicipality] = useState<string[]>([]);
  const [cae, setCae] = useState<string | null>(null);
  const companies = useMemo(() => prospects.map(prospect => ({
    prospect,
    data: readMjCompanyData(prospect.metadata),
  })), [prospects]);
  const options = useMemo(() => {
    const districts = new Map<string, string>();
    const municipalities = new Map<string, string>();
    const caes = new Map<string, string>();
    for (const { data } of companies) {
      if (!data) continue;
      if (data.distrito) districts.set(normalizeString(data.distrito), data.distrito);
      if (data.concelho && (!district.length || district.includes(normalizeString(data.distrito || '')))) {
        municipalities.set(normalizeString(data.concelho), data.concelho);
      }
      if (data.caePrincipal) caes.set(normalizeString(data.caePrincipal), data.caePrincipal);
    }
    const list = (values: ReadonlyMap<string, string>) => [...values].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-PT', { numeric: true }));
    return { districts: list(districts), municipalities: list(municipalities), caes: list(caes) };
  }, [companies, district]);
  const filtered = useMemo(() => companies.filter(({ data }) =>
    (!district.length || district.includes(normalizeString(data?.distrito || ''))) &&
    (!municipality.length || municipality.includes(normalizeString(data?.concelho || ''))) &&
    (!cae || normalizeString(data?.caePrincipal || '') === cae)
  ).map(({ prospect }) => prospect), [companies, district, municipality, cae]);
  const changeDistrict = (value: string[]) => {
    setDistrict(value);
    const allowed = new Set(companies.flatMap(({ data }) =>
      data?.concelho && (!value.length || value.includes(normalizeString(data.distrito || '')))
        ? [normalizeString(data.concelho)] : []));
    setMunicipality(current => current.filter(item => allowed.has(item)));
  };
  const clear = () => { setDistrict([]); setMunicipality([]); setCae(null); };
  return { district, municipality, cae, options, filtered, changeDistrict, setMunicipality, setCae, clear };
}
