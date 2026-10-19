import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { clockApi } from '../api';
import type { Snapshot } from '../types';
const resultSchema = z.object({ tag: z.object({ id: z.string() }), token: z.string().optional(), aes_key: z.string().optional(), profile: z.string().optional() });
type Props = { readonly snapshot: Snapshot; readonly org: string; readonly refresh: () => Promise<unknown> };
export function NfcManager({ snapshot, org, refresh }: Props) {
  const [editor, setEditor] = useState<{ readonly op: 'create' | 'rotate' | 'disable'; readonly id?: string } | null>(null);
  const [secret, setSecret] = useState<z.infer<typeof resultSchema> | null>(null);
  const [kind, setKind] = useState('static');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement) {
    if (!editor) return;
    const fields = new FormData(form);
    const reason = String(fields.get('reason') ?? '').trim();
    if ((reason.match(/\p{L}/gu)?.length ?? 0) < 3) { setError('Indique uma justificação com pelo menos 3 letras.'); return; }
    setBusy(true); setError('');
    try {
      const result = await clockApi.manageTag({ org, ...editor, reason, ...(editor.op === 'disable' ? {} : { kind, ...(editor.op === 'create' ? { name: String(fields.get('name') ?? ''), location_id: String(fields.get('location_id') ?? '') } : {}), ...(kind === 'ntag424' ? { uid_hex: String(fields.get('uid_hex') ?? '') } : {}) }) });
      const parsed = resultSchema.parse(result); setSecret(parsed.token || parsed.aes_key ? parsed : null); await refresh(); setEditor(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível configurar a etiqueta.'); } finally { setBusy(false); }
  }
  return <section className="ponto-card"><div className="ponto-card-header"><div><h3>Etiquetas NFC</h3><p className="text-xs text-muted-foreground mt-1">Credenciais reveladas apenas na criação ou rotação</p></div><Button disabled={snapshot.locations.length === 0} onClick={() => { setError(''); setKind('static'); setEditor({ op: 'create' }); }}>Criar etiqueta</Button></div><div className="ponto-config-list">{snapshot.tags.length === 0 ? <p className="ponto-blank">Sem etiquetas. Configure primeiro um local de trabalho.</p> : snapshot.tags.map(tag => <div className="ponto-config-row" key={tag.id}><div><strong className="text-sm">{tag.name}</strong><p>{snapshot.locations.find(location => location.id === tag.location_id)?.name} · {tag.kind === 'static' ? 'Estática' : 'NTAG424 DNA'} · {tag.is_active ? 'Ativa' : 'Inativa'} · contador {tag.last_counter}</p></div><div className="flex gap-1 flex-wrap"><Button variant="outline" onClick={() => { setError(''); setKind(tag.kind); setEditor({ op: 'rotate', id: tag.id }); }}>Rodar chave</Button>{tag.is_active && <Button variant="ghost" onClick={() => { setError(''); setEditor({ op: 'disable', id: tag.id }); }}>Desativar</Button>}</div></div>)}</div>
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !busy) setEditor(null); }}><DialogContent className="workspace-theme ponto-dialog"><DialogHeader><DialogTitle>{editor?.op === 'create' ? 'Criar etiqueta NFC' : editor?.op === 'rotate' ? 'Rodar credenciais NFC' : 'Desativar etiqueta NFC'}</DialogTitle><DialogDescription>A rotação invalida a credencial anterior. Configure a etiqueta física com a nova credencial.</DialogDescription></DialogHeader>{editor && <form className="ponto-form" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}>{editor.op !== 'disable' && <>{editor.op === 'create' && <><label>Nome<input name="name" required /></label><label>Local<select name="location_id" required><option value="">Selecionar local</option>{snapshot.locations.filter(location => location.is_active).map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label></>}<label>Tipo<select value={kind} onChange={event => setKind(event.target.value)}><option value="static">NFC estática</option><option value="ntag424">NTAG424 DNA</option></select></label>{kind === 'ntag424' && <label>UID hexadecimal (14 caracteres)<input name="uid_hex" required pattern="[a-fA-F0-9]{14}" minLength={14} maxLength={14} /></label>}</>}<label>Justificação<textarea name="reason" minLength={3} required /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy}>{busy ? 'A guardar…' : 'Confirmar'}</Button></form>}</DialogContent></Dialog>
    <Dialog open={!!secret} onOpenChange={open => { if (!open) setSecret(null); }}><DialogContent className="workspace-theme ponto-dialog"><DialogHeader><DialogTitle>Guardar credenciais da etiqueta</DialogTitle><DialogDescription>Estas credenciais são apresentadas uma única vez. Guarde-as de forma segura antes de fechar.</DialogDescription></DialogHeader>{secret && <div className="ponto-form"><label>ID da etiqueta<input readOnly value={secret.tag.id} onFocus={event => event.target.select()} /></label>{secret.token && <label>Token estático<input readOnly value={secret.token} onFocus={event => event.target.select()} /></label>}{secret.token && <label>URL para gravar na etiqueta<input readOnly value={`${window.location.origin}/ponto/nfc?tag=${encodeURIComponent(secret.tag.id)}&token=${encodeURIComponent(secret.token)}`} onFocus={event => event.target.select()} /></label>}{secret.aes_key && <label>Chave AES<input readOnly value={secret.aes_key} onFocus={event => event.target.select()} /></label>}{secret.profile && <p className="text-xs break-all">Perfil: {secret.profile}</p>}<Button onClick={() => setSecret(null)}>Credenciais guardadas</Button></div>}</DialogContent></Dialog>
  </section>;
}
