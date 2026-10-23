import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeString } from '@/lib/utils';

type Props = {
  readonly label: string;
  readonly emptyLabel: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly value: readonly string[];
  readonly onChange: (value: string[]) => void;
};
export function ProspectLocationSelect({ label, emptyLabel, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedLabels = options.filter(option => value.includes(option.value)).map(option => option.label);
  const summary = selectedLabels.length ? selectedLabels.join(', ') : emptyLabel;
  const visibleOptions = options.filter(option => normalizeString(option.label).includes(normalizeString(search)));
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(''); }} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={`${label}: ${summary}`} aria-expanded={open} className="w-full min-w-0 justify-between font-normal" title={summary}>
          <span className="truncate">{summary}</span>
          <ChevronsUpDown aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-2">
        <Input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Pesquisar ${label.toLowerCase()}…`} aria-label={`Pesquisar ${label.toLowerCase()}`} className="mb-2" />
        <div className="max-h-60 space-y-1 overflow-y-auto" role="group" aria-label={`Selecionar ${label.toLowerCase()}`}>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent">
            <Checkbox checked={value.length === 0} onCheckedChange={() => onChange([])} />
            <span className="text-sm">{emptyLabel}</span>
          </label>
          {visibleOptions.map(option => (
            <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent">
              <Checkbox checked={value.includes(option.value)} onCheckedChange={checked => onChange(checked === true ? [...value, option.value] : value.filter(item => item !== option.value))} />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
          {!visibleOptions.length && <p className="p-2 text-sm text-muted-foreground">Nenhum resultado encontrado.</p>}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <span className="text-xs text-muted-foreground">{value.length} selecionados</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Concluir</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
