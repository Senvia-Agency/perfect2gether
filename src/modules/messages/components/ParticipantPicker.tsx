import { Check, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { PersonAvatar } from './PersonAvatar';

type Person = { readonly id: string; readonly name: string; readonly avatar?: string | null };
export function ParticipantPicker({ people, selected, change, single, disabled, compact = false }: {
  readonly compact?: boolean; readonly people: readonly Person[]; readonly selected: readonly string[];
  readonly change: (ids: string[]) => void; readonly single: boolean; readonly disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const visible = people.filter(person => person.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className={compact ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-3'}>
    {!compact && <div className="flex items-center justify-between"><span className="text-sm font-medium">{single ? 'Com quem queres falar?' : 'Participantes'}</span><span className="text-xs text-muted-foreground">{selected.length} {selected.length === 1 ? 'selecionado' : 'selecionados'}</span></div>}
    <div className={compact ? 'relative mx-2 shrink-0' : 'relative'}><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Pesquisar participantes" placeholder="Procurar pelo nome…" className="h-11 rounded-2xl border-transparent bg-muted/60 pl-9 shadow-none focus-visible:border-primary/30" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <div className={compact ? 'min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-1' : 'max-h-[min(32dvh,17rem)] min-h-24 space-y-1 overflow-y-auto rounded-xl border bg-card p-1.5'} role="group" aria-label="Participantes">
      {visible.map(person => {
        const checked = selected.includes(person.id);
        return <label key={person.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/70 ${checked ? 'bg-primary/[0.07]' : ''} ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
          <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={() => change(checked ? selected.filter(id => id !== person.id) : single ? [person.id] : [...selected, person.id])} />
          <PersonAvatar name={person.name} image={person.avatar} colorful={compact} className={compact ? 'h-11 w-11' : undefined} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{person.name}</span>{compact && <span className="mt-0.5 block text-xs text-muted-foreground">Equipa Perfect2Gether</span>}</span>
          <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-2 bg-card'}`}>{checked && <Check className="h-3.5 w-3.5" />}</span>
        </label>;
      })}
      {!visible.length && <div className="flex flex-col items-center gap-2 px-4 py-7 text-center text-sm text-muted-foreground"><Users className="h-5 w-5" />{people.length ? 'Não encontrámos ninguém com esse nome.' : 'Não há mais participantes disponíveis.'}</div>}
    </div>
  </div>;
}
