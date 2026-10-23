import { useMemo, useState } from 'react';
import type { Prospect } from '@/types/prospects';
import { readMjCompanyData } from '@/lib/prospects/mj-metadata';
import { normalizeString } from '@/lib/utils';

export function useProspectCompanyFilters(prospects: readonly Prospect[]) {
  const [district, setDistrict] = useState<string | null>(null);
  const [municipality, setMunicipality] = useState<string | null>(null);
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
      if (data.concelho && (!district || normalizeString(data.distrito || '') === district)) {
        municipalities.set(normalizeString(data.concelho), data.concelho);
      }
      if (data.caePrincipal) caes.set(normalizeString(data.caePrincipal), data.caePrincipal);
    }
    const list = (values: ReadonlyMap<string, string>) => [...values].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-PT', { numeric: true }));
    return { districts: list(districts), municipalities: list(municipalities), caes: list(caes) };
  }, [companies, district]);
  const filtered = useMemo(() => companies.filter(({ data }) =>
    (!district || normalizeString(data?.distrito || '') === district) &&
    (!municipality || normalizeString(data?.concelho || '') === municipality) &&
    (!cae || normalizeString(data?.caePrincipal || '') === cae)
  ).map(({ prospect }) => prospect), [companies, district, municipality, cae]);
  const changeDistrict = (value: string | null) => {
    setDistrict(value);
    setMunicipality(null);
  };
  const clear = () => { setDistrict(null); setMunicipality(null); setCae(null); };
  return { district, municipality, cae, options, filtered, changeDistrict, setMunicipality, setCae, clear };
}
