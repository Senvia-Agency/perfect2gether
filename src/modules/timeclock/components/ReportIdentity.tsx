import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { clockApi } from '../api';
import type { Snapshot } from '../types';
const identityInput = z.object({ name: z.string().trim().min(1, 'Indique o nome da entidade.'), nif: z.string().trim().regex(/^\d{9}$/, 'O NIF deve ter 9 algarismos.'), logo_url: z.union([z.string().url('Indique um URL válido para o logótipo.').regex(/^https?:\/\//, 'Utilize um URL HTTP ou HTTPS.'), z.literal('')]), reason: z.string().trim().refine(value => (value.match(/\p{L}/gu)?.length ?? 0) >= 3, 'Indique uma justificação com pelo menos 3 letras.') });
export function ReportIdentity({ snapshot, org, refresh }: { readonly snapshot: Snapshot; readonly org: string; readonly refresh: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function save(form: HTMLFormElement) {
    const parsed = identityInput.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? 'Verifique os dados.'); return; }
    setBusy(true); setMessage('');
    try { await clockApi.call('settings_save', { org, ...parsed.data, logo_url: parsed.data.logo_url || null }); await refresh(); setMessage('Dados da entidade guardados.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível guardar.'); } finally { setBusy(false); }
  }
  return <section className="ponto-card"><div className="ponto-card-header"><div><h3>Dados da entidade</h3><p className="text-xs text-muted-foreground mt-1">Identificação apresentada nas folhas de ponto em PDF</p></div></div><form className="ponto-form p-5" onSubmit={event => { event.preventDefault(); void save(event.currentTarget); }}><div className="ponto-form-grid"><label>Nome da entidade<input name="name" required defaultValue={snapshot.report_identity.name} /></label><label>NIF<input name="nif" required inputMode="numeric" pattern="[0-9]{9}" minLength={9} maxLength={9} defaultValue={snapshot.report_identity.nif} /></label></div><label>URL do logótipo (opcional)<input name="logo_url" type="url" defaultValue={snapshot.report_identity.logo_url ?? ''} placeholder="https://…" /></label><label>Justificação obrigatória<textarea name="reason" minLength={3} required maxLength={300} /></label>{message && <p role="status" className="text-sm">{message}</p>}<Button className="justify-self-start" type="submit" disabled={busy}>{busy ? 'A guardar…' : 'Guardar dados da entidade'}</Button></form></section>;
}
