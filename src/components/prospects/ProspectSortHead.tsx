import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import type { ProspectSort, ProspectSortField } from '@/hooks/useProspectSort';

export function ProspectSortHead({ label, field, sort, onSort }: {
  readonly label: string;
  readonly field: ProspectSortField;
  readonly sort: ProspectSort;
  readonly onSort: (field: ProspectSortField) => void;
}) {
  const active = sort.field === field;
  const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm py-2 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSort(field)} title={`Ordenar por ${label}`}>
        {label}<Icon aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
      </button>
    </TableHead>
  );
}
