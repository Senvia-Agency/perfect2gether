import { useState } from 'react';
import { ArrowRight, LockKeyhole, Megaphone, MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { MessagesController } from '../useMessages';
import type { Conversation } from '../types';
import { NewConversationDialog } from './NewConversationDialog';
import { ParticipantPicker } from './ParticipantPicker';
import { PersonAvatar } from './PersonAvatar';

const kinds = [
  { value: 'direct', label: 'Privada', icon: MessageCircle, description: 'Uma conversa entre duas pessoas.' },
  { value: 'group', label: 'Grupo', icon: Users, description: 'Um espaço para trabalhar em equipa.' },
  { value: 'announcement', label: 'Anúncio', icon: Megaphone, description: 'Só os responsáveis podem publicar.' },
] as const;

function ManageConversationDialog({ controller, conversation, open, close }: { readonly controller: MessagesController; readonly conversation?: Conversation; readonly open: boolean; readonly close: () => void }) {
  const [title, setTitle] = useState(conversation?.title ?? '');
  const [kind, setKind] = useState<Conversation['kind']>('direct');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = conversation?.members.some(member => member.id === controller.userId && member.role === 'owner');
  const people = controller.snapshot?.people.filter((person): person is { id: string; name: string; avatar?: string | null } => typeof person.id === "string" && typeof person.name === "string").filter(person => person.id !== controller.userId && !conversation?.members.some(member => member.id === person.id)) ?? [];
  async function run(action: () => Promise<unknown>, done = false) {
    setBusy(true); setError('');
    try { await action(); if (done) { setSelected([]); setTitle(''); close(); } }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) close(); }}><DialogContent className="messages-theme !max-w-[36rem] gap-0 overflow-hidden rounded-3xl bg-card p-0" style={{ width: 'calc(100vw - 2rem)' }}>
    <div className="border-b px-6 pb-5 pt-6 sm:px-7"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div><DialogTitle className="text-xl font-semibold tracking-tight">{conversation ? 'Gerir conversa' : 'Começar uma conversa'}</DialogTitle><DialogDescription className="mt-2 max-w-sm leading-relaxed">{conversation ? 'Gere os participantes e os detalhes deste espaço.' : 'Escolhe com quem queres falar. O conteúdo fica reservado aos participantes.'}</DialogDescription></div>
    <div className="max-h-[55dvh] space-y-5 overflow-y-auto p-6 sm:px-7">
      {!conversation && <div><div className="grid grid-cols-3 gap-2" aria-label="Tipo de conversa">{kinds.filter(item => item.value !== 'announcement' || controller.snapshot?.can_announce).map(item => <button key={item.value} type="button" aria-pressed={kind === item.value} disabled={busy} onClick={() => { setKind(item.value); setSelected([]); }} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === item.value ? 'border-primary bg-primary/[0.07] text-primary' : 'bg-background/40 text-muted-foreground hover:bg-muted'}`}><item.icon className="h-5 w-5" />{item.label}</button>)}</div><p className="mt-2 text-xs text-muted-foreground">{kinds.find(item => item.value === kind)?.description}</p></div>}
      {((!conversation && kind !== 'direct') || (conversation && owner)) && <div className="space-y-2"><label htmlFor="conversation-name" className="text-sm font-medium">Nome da conversa</label><div className="flex gap-2"><Input id="conversation-name" value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Equipa comercial" className="h-11 rounded-xl" />{conversation && <Button variant="outline" disabled={busy || !title.trim()} onClick={() => void run(() => controller.manage({ conversation: conversation.id, op: 'rename', title }))}>Guardar</Button>}</div></div>}
      {conversation && <div className="space-y-2"><p className="text-sm font-medium">{conversation.members.length} participantes</p><ul className="space-y-2">{conversation.members.map(member => <li key={member.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"><PersonAvatar name={member.name} image={member.avatar} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.role === 'owner' ? 'Responsável' : 'Participante'}</p></div>{owner && member.id !== controller.userId && <div className="flex gap-1">{member.role !== 'owner' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => controller.manage({ conversation: conversation.id, op: 'promote', user: member.id }))}>Promover</Button>}<Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void run(() => controller.manage({ conversation: conversation.id, op: 'remove', user: member.id }))}>Remover</Button></div>}</li>)}</ul></div>}
      {(!conversation || owner) && <ParticipantPicker people={people} selected={selected} change={setSelected} single={!conversation && kind === 'direct'} disabled={busy} />}
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    </div>
    <div className="space-y-3 border-t bg-muted/25 p-5 sm:px-7">
      <div className="flex items-center justify-between gap-3"><Button variant="ghost" className="rounded-xl" disabled={busy} onClick={close}>Cancelar</Button>
        {conversation ? <div className="flex flex-wrap justify-end gap-2">{owner && <Button className="rounded-xl" disabled={busy || !selected.length} onClick={() => void run(async () => { for (const user of selected) await controller.manage({ conversation: conversation.id, op: 'add', user }); setSelected([]); })}>Adicionar ({selected.length})</Button>}<Button variant="outline" className="rounded-xl text-destructive" disabled={busy} onClick={() => { if (window.confirm('Sair da conversa e perder o acesso ao histórico?')) void run(() => controller.manage({ conversation: conversation.id, op: 'leave' }), true); }}>Sair</Button></div>
          : <Button className="gap-2 rounded-xl px-5" disabled={busy || !selected.length || (kind !== 'direct' && !title.trim())} onClick={() => void run(async () => { const id = await controller.create({ org: controller.orgId, kind, title, participants: selected }); controller.select(id); }, true)}>{busy ? 'A criar…' : 'Iniciar conversa'}<ArrowRight className="h-4 w-4" /></Button>}
      </div>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><LockKeyhole className="h-3 w-3" />Acesso exclusivo aos participantes da conversa</p>
    </div>
  </DialogContent></Dialog>;
}

export function ConversationDialog(props: { readonly controller: MessagesController; readonly conversation?: Conversation; readonly open: boolean; readonly close: () => void }) {
  return props.conversation ? <ManageConversationDialog {...props} /> : <NewConversationDialog {...props} />;
}
