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
          <SearchableCombobox options={filters.options.districts} value={filters.district} onValueChange={filters.changeDistrict} emptyLabel="Todos os distritos" searchPlaceholder="Pesquisar distrito…" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Concelho</p>
          <SearchableCombobox options={filters.options.municipalities} value={filters.municipality} onValueChange={filters.setMunicipality} emptyLabel="Todos os concelhos" searchPlaceholder="Pesquisar concelho…" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">CAE principal</p>
          <SearchableCombobox options={filters.options.caes} value={filters.cae} onValueChange={filters.setCae} emptyLabel="Todos os CAE principais" searchPlaceholder="Pesquisar CAE principal…" />
        </div>
      </div>
      {(filters.district || filters.municipality || filters.cae) && (
        <Button type="button" variant="ghost" size="sm" onClick={filters.clear}>Limpar localização e CAE</Button>
      )}
    </fieldset>
  );
}
