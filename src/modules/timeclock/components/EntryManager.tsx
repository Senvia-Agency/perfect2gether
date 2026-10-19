import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { clockApi } from '../api';
import { actionSchema } from '../types';
import type { Entry, Person } from '../types';
import { actionLabels, localInput, statusLabels, clockTime } from './presentation';

type Operation = 'create' | 'edit' | 'approve' | 'reject' | 'void' | 'restore';
const operations: Readonly<Record<Operation, string>> = { create: 'Criar registo', edit: 'Editar registo', approve: 'Aprovar', reject: 'Rejeitar', void: 'Anular', restore: 'Restaurar' };
type Props = { readonly entries: readonly Entry[]; readonly people: readonly Person[]; readonly userId: string; readonly org: string; readonly refresh: () => Promise<unknown> };
export function EntryManager({ entries, people, userId, org, refresh }: Props) {
  const [selected, setSelected] = useState<{ op: Operation; entry?: Entry } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const visible = entries.filter(entry => (status === 'all' || entry.status === status) && (people.find(person => person.id === entry.user_id)?.name ?? '').toLowerCase().includes(search.toLowerCase()));
  async function submit(form: HTMLFormElement) {
    if (!selected) return;
    const fields = new FormData(form);
    const parsed = z.object({ reason: z.string().trim().refine(value => (value.match(/\p{L}/gu)?.length ?? 0) >= 3, 'Indique uma justificação com pelo menos 3 letras.'), user: z.string().min(1), action: actionSchema, at: z.string().min(1), note: z.string() }).safeParse({ ...(selected.entry ? { user: selected.entry.user_id, action: selected.entry.action, at: localInput(selected.entry.punched_at), note: selected.entry.note } : {}), ...Object.fromEntries(fields) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Verifique os campos.'); return; }
    setBusy(true); setError('');
    try {
      await clockApi.call('entry_manage', { org, op: selected.op, ...(selected.entry ? { id: selected.entry.id } : {}), ...parsed.data, at: new Date(parsed.data.at).toISOString() });
      await refresh(); setSelected(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível guardar.'); } finally { setBusy(false); }
  }
  return <section className="ponto-card"><div className="ponto-card-header"><h3>Registos da equipa</h3><div className="ponto-controls"><input aria-label="Pesquisar colaborador" placeholder="Pesquisar pessoa…" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filtrar estado" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button onClick={() => { setError(''); setSelected({ op: 'create' }); }}>Criar registo</Button></div></div>
    {visible.length === 0 ? <p className="ponto-blank">Sem registos para estes filtros.</p> : <div className="ponto-table-scroll"><table className="ponto-table"><thead><tr><th>Pessoa</th><th>Data e hora</th><th>Registo</th><th>Local / origem</th><th>Estado</th><th>Observação</th><th>Ações</th></tr></thead><tbody>{visible.map(entry => <tr key={entry.id}><td>{people.find(person => person.id === entry.user_id)?.name ?? 'Colaborador'}</td><td>{new Date(entry.punched_at).toLocaleDateString('pt-PT')} · {clockTime(entry.punched_at)}</td><td>{actionLabels[entry.action]}{entry.corrected && ' *'}</td><td>{entry.location_name || 'Sem localização'}<br /><small>{entry.source} {entry.distance_m !== null && `· ${Math.round(entry.distance_m)} m`}</small></td><td><span className={`clock-badge ${entry.status}`}>{statusLabels[entry.status]}</span>{entry.flags.length > 0 && <p className="text-xs mt-1">{entry.flags.join(', ')}</p>}</td><td className="ponto-notes">{entry.note || '—'}</td><td>{entry.user_id === userId ? <span className="text-muted-foreground">Registo próprio</span> : <div className="flex gap-1">{(entry.status === 'voided' ? ['restore'] as const : entry.status === 'pending' || entry.status === 'flagged' ? ['approve', 'reject', 'edit', 'void'] as const : ['edit', 'void'] as const).map(op => <Button key={op} size="sm" variant="ghost" onClick={() => { setError(''); setSelected({ op, entry }); }}>{operations[op]}</Button>)}</div>}</td></tr>)}</tbody></table></div>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><DialogContent className="workspace-theme ponto-dialog"><DialogHeader><DialogTitle>{selected ? operations[selected.op] : ''}</DialogTitle><DialogDescription>Todas as alterações ficam no histórico. Não pode alterar os seus próprios registos.</DialogDescription></DialogHeader>
      {selected && <form className="ponto-form" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}><fieldset className="ponto-form" disabled={busy || (selected.op !== 'create' && selected.op !== 'edit')}><label>Colaborador<select name="user" defaultValue={selected.entry?.user_id ?? ''} required disabled={busy || selected.op !== 'create'}><option value="" disabled>Selecionar pessoa</option>{people.filter(person => person.id !== userId).map(person => <option key={person.id} value={person.id}>{person.name}{!person.is_active && ' (inativo)'}</option>)}</select></label><div className="ponto-form-grid"><label>Tipo<select name="action" defaultValue={selected.entry?.action ?? 'start'}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Data e hora<input required type="datetime-local" name="at" defaultValue={localInput(selected.entry?.punched_at ?? new Date().toISOString())} /></label></div><label>Observação<textarea name="note" defaultValue={selected.entry?.note ?? ''} maxLength={300} /></label></fieldset><label>Justificação obrigatória<textarea name="reason" required minLength={3} maxLength={300} placeholder="Explique o motivo desta alteração…" /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy}>{busy ? 'A guardar…' : operations[selected.op]}</Button></form>}
    </DialogContent></Dialog>
  </section>;
}
