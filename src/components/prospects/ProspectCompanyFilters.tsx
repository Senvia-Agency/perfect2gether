import { ProspectLocationSelect } from './ProspectLocationSelect';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { Button } from '@/components/ui/button';
import type { useProspectCompanyFilters } from '@/hooks/useProspectCompanyFilters';

type Props = { readonly filters: ReturnType<typeof useProspectCompanyFilters> };
export function ProspectCompanyFilters({ filters }: Props) {
  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Localização e atividade</legend>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Distrito</p>
          <ProspectLocationSelect label="Distrito" options={filters.options.districts} value={filters.district} onChange={filters.changeDistrict} emptyLabel="Todos os distritos" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Concelho</p>
          <ProspectLocationSelect label="Concelho" options={filters.options.municipalities} value={filters.municipality} onChange={filters.setMunicipality} emptyLabel="Todos os concelhos" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">CAE principal</p>
          <SearchableCombobox options={filters.options.caes} value={filters.cae} onValueChange={filters.setCae} emptyLabel="Todos os CAE principais" searchPlaceholder="Pesquisar CAE principal…" />
        </div>
      </div>
      {(filters.district.length > 0 || filters.municipality.length > 0 || filters.cae) && (
        <Button type="button" variant="ghost" size="sm" onClick={filters.clear}>Limpar localização e CAE</Button>
      )}
    </fieldset>
  );
}
