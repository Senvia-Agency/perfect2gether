import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProspectDateRange } from '@/lib/prospects/dates';

type RangeProps = {
  readonly id: string;
  readonly title: string;
  readonly value: ProspectDateRange;
  readonly onChange: (value: ProspectDateRange) => void;
};
function DateRange({ id, title, value, onChange }: RangeProps) {
  const invalid = !!value.from && !!value.to && value.from > value.to;
  return <fieldset className="min-w-0 space-y-2 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">{title}</legend>
    <div className="grid grid-cols-2 gap-3">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">De</Label>
        <Input id={`${id}-from`} type="date" value={value.from} max={value.to || undefined} aria-label={`${title}: de`} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} onChange={event => onChange({ ...value, from: event.target.value })} className="min-w-0" />
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">Até</Label>
        <Input id={`${id}-to`} type="date" value={value.to} min={value.from || undefined} aria-label={`${title}: até`} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} onChange={event => onChange({ ...value, to: event.target.value })} className="min-w-0" />
      </div>
    </div>
    {invalid && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">A data inicial deve ser anterior ou igual à final.</p>}
  </fieldset>;
}

type Props = {
  readonly imported: ProspectDateRange;
  readonly opening: ProspectDateRange;
  readonly onImportedChange: (range: ProspectDateRange) => void;
  readonly onOpeningChange: (range: ProspectDateRange) => void;
};
export function ProspectDateFilters({ imported, opening, onImportedChange, onOpeningChange }: Props) {
  const active = imported.from || imported.to || opening.from || opening.to;
  return <div className="space-y-2">
    <div className="grid gap-3 lg:grid-cols-2">
      <DateRange id="prospect-imported" title="Data de importação" value={imported} onChange={onImportedChange} />
      <DateRange id="prospect-opening" title="Data de abertura" value={opening} onChange={onOpeningChange} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">Abertura identificada como publicação MJ usa a data da publicação da constituição.</p>
      {active && <Button type="button" variant="ghost" size="sm" onClick={() => { onImportedChange({ from: '', to: '' }); onOpeningChange({ from: '', to: '' }); }}>Limpar datas</Button>}
    </div>
  </div>;
}
