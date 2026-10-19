import { useState } from 'react';
import { Check, CheckCheck, MoreHorizontal, Pin, Reply, SmilePlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { MessagesController } from '../useMessages';
import type { Message } from '../types';
import { AttachmentCard } from './AttachmentCard';

function MessageText({ text }: { readonly text: string }) {
  return <p className="whitespace-pre-wrap break-words text-sm">{text.split(/(https?:\/\/[^\s]+|\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => /^https?:\/\//.test(part) ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="underline">{part}</a> : part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith('`') && part.endsWith('`') ? <code key={index} className="rounded bg-muted px-1 text-foreground">{part.slice(1, -1)}</code> : <span key={index}>{part}</span>)}</p>;
}

export function MessageBubble({ message, controller, onReply }: { readonly message: Message; readonly controller: MessagesController; readonly onReply: (id: string) => void }) {
  const [reactionOpen, setReactionOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(message.body);
  const [forward, setForward] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const conversation = controller.snapshot?.conversations.find(item => item.id === message.conversation_id);
  const own = message.sender_id === controller.userId;
  const canPin = conversation?.kind === 'direct' || conversation?.members.some(member => member.id === controller.userId && member.role === 'owner');
  const reply = controller.messages.find(item => item.id === message.reply_to);
  const author = conversation?.members.find(member => member.id === message.sender_id)?.name ?? 'Participante';
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); setEditing(false); setForward(false); setDeleting(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.'); }
    finally { setBusy(false); }
  }
  const reactions = Array.from(new Set(message.reactions.map(item => item.emoji)));
  const read = conversation?.members.some(member => member.id !== controller.userId && member.last_read_at && member.last_read_at >= message.created_at);
  return <article id={`message-${message.id}`} tabIndex={-1} onPointerDown={event => { if (event.pointerType === 'touch' && event.target instanceof Element && !event.target.closest('button,a,textarea')) event.currentTarget.focus({ preventScroll: true }); }} data-own={own} className="chat-message-row outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <div className="chat-message-stack">
    <div className="chat-bubble" data-own={own}>
    {(!own && conversation?.kind !== 'direct' || message.edited_at || message.forwarded || message.pinned) && <div className="chat-secondary mb-1 flex flex-wrap items-center gap-2 text-xs">{!own && conversation?.kind !== 'direct' && <span className="font-semibold">{author}</span>}{message.edited_at && <span>editada</span>}{message.forwarded && <span>Encaminhada</span>}{message.pinned && <span className="inline-flex items-center gap-1"><Pin className="h-3 w-3" aria-hidden="true" />Fixada</span>}</div>}
    {message.deleted_at ? <p className="text-sm italic text-muted-foreground">Mensagem eliminada</p> : <>
      {message.reply_to && <button type="button" className="mb-2 block min-h-10 w-full border-l-2 border-primary bg-muted px-3 py-2 text-left text-xs text-foreground" onClick={() => { const target = document.getElementById(`message-${message.reply_to}`); if (target) { target.scrollIntoView({ block: 'center' }); target.focus({ preventScroll: true }); } else if (message.reply_to) void run(() => controller.jump({ conversation_id: message.conversation_id, message_id: message.reply_to ?? '', body: '' })); }}>{reply?.body || 'Ver mensagem original'}</button>}
      {editing ? <div className="space-y-2"><Textarea className="text-foreground" aria-label="Editar mensagem" value={body} onChange={event => setBody(event.target.value)} /><Button disabled={busy || !body.trim()} onClick={() => void run(() => controller.edit(message.id, body))}>Guardar</Button><Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></div> : message.body && <MessageText text={message.body} />}
      {message.attachments.length > 0 && <div className="mt-2 grid gap-2">{message.attachments.map(attachment => <AttachmentCard key={attachment.id} attachment={attachment} gallery={message.attachments.filter(item => item.mime.startsWith('image/'))} />)}</div>}
      {reactions.length > 0 && <div className="chat-reactions mt-2 flex flex-wrap gap-1">{reactions.map(emoji => <button type="button" key={emoji} aria-pressed={message.reactions.some(item => item.emoji === emoji && item.user_id === controller.userId)} disabled={busy} aria-label={`Reagir com ${emoji}`} onClick={() => void run(() => controller.react(message.id, emoji))}>{emoji}<span>{message.reactions.filter(item => item.emoji === emoji).length}</span></button>)}</div>}
    </>}
      <div className="chat-secondary chat-message-meta"><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</time>{own && !message.deleted_at && <span aria-label={read ? 'Lida' : 'Enviada'} title={read ? 'Lida' : 'Enviada'}>{read ? <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <Check aria-hidden="true" className="h-3.5 w-3.5" />}</span>}</div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
    {!message.deleted_at && <div className="chat-message-actions" role="group" aria-label="Ações da mensagem">
      <Button variant="ghost" size="icon" title="Responder" aria-label="Responder à mensagem" onClick={() => onReply(message.id)}><Reply className="h-4 w-4" /></Button>
      <Popover open={reactionOpen} onOpenChange={setReactionOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" title="Adicionar reação" aria-label="Adicionar reação" disabled={busy}><SmilePlus className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent className="messages-theme chat-reaction-picker" aria-label="Reações da mensagem" side="top" align={own ? 'end' : 'start'} sideOffset={8}><div role="group" aria-label="Escolher reação">{[
        {emoji:'👍',label:'Gostei'}, {emoji:'❤️',label:'Adorei'}, {emoji:'😊',label:'Sorriso'},
        {emoji:'🎉',label:'Celebrar'}, {emoji:'👀',label:'A acompanhar'}, {emoji:'✅',label:'Concluído'},
      ].map(reaction => <button type="button" key={reaction.emoji} disabled={busy} aria-label={reaction.label} onClick={() => { setReactionOpen(false); void run(() => controller.react(message.id, reaction.emoji)); }}>{reaction.emoji}</button>)}</div></PopoverContent></Popover>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mais opções da mensagem" disabled={busy}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem className="min-h-10" onSelect={() => setForward(true)}>Encaminhar</DropdownMenuItem>
        <DropdownMenuItem className="min-h-10" onSelect={() => void run(() => controller.save(message.id, !message.saved))}>{message.saved ? 'Retirar dos guardados' : 'Guardar'}</DropdownMenuItem>
        {canPin && <DropdownMenuItem className="min-h-10" onSelect={() => void run(() => controller.pinMessage(message.id, !message.pinned))}>{message.pinned ? 'Desafixar' : 'Fixar'}</DropdownMenuItem>}
        {own && <><DropdownMenuItem className="min-h-10" onSelect={() => { setBody(message.body); setEditing(true); }}>Editar</DropdownMenuItem><DropdownMenuItem className="min-h-10 text-destructive" onSelect={() => setDeleting(true)}>Eliminar</DropdownMenuItem></>}
      </DropdownMenuContent></DropdownMenu></div>}
    <Dialog open={forward} onOpenChange={setForward}><DialogContent className="messages-theme !max-w-lg rounded-3xl bg-card"><DialogTitle>Encaminhar mensagem</DialogTitle><DialogDescription>Escolha uma conversa. A mensagem será identificada como encaminhada.</DialogDescription><div className="max-h-80 space-y-2 overflow-y-auto">{controller.snapshot?.conversations.filter(item => item.id !== message.conversation_id).map(item => <Button key={item.id} variant="outline" className="w-full justify-start" disabled={busy} onClick={() => void run(() => controller.forward(message, item.id))}>{item.title || 'Conversa privada'}</Button>)}</div></DialogContent></Dialog>
    <Dialog open={deleting} onOpenChange={setDeleting}><DialogContent className="messages-theme !max-w-lg rounded-3xl bg-card"><DialogTitle>Eliminar mensagem?</DialogTitle><DialogDescription>O conteúdo e os anexos deixarão de estar disponíveis nesta conversa.</DialogDescription><Button variant="destructive" disabled={busy} onClick={() => void run(() => controller.remove(message.id))}>Confirmar eliminação</Button><Button variant="outline" onClick={() => setDeleting(false)}>Cancelar</Button></DialogContent></Dialog>
    </div>
  </article>;
}



