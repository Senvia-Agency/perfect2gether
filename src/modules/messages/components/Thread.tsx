import { Fragment, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, BellOff, MessageSquare, MoreHorizontal, Pin, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { MessagesController } from '../useMessages';
import { Composer } from './Composer';
import { ConversationDialog } from './ConversationDialog';
import { MessageBubble } from './MessageBubble';
import { useMessageDraft } from './MessageDrafts';
import { PersonAvatar } from './PersonAvatar';

export function Thread({ controller, onNew }: { readonly controller: MessagesController; readonly onNew: () => void }) {
  const { draft, update } = useMessageDraft(controller.selectedId ?? '');
  const [manage, setManage] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(timer); }, []);
  const bottom = useRef<HTMLDivElement>(null);
  const draftInput = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const conversation = controller.snapshot?.conversations.find(item => item.id === controller.selectedId);
  const latest = controller.messages[controller.messages.length - 1]?.id;
  useEffect(() => { const element = scroll.current; if (element && element.scrollHeight - element.scrollTop - element.clientHeight < 300) bottom.current?.scrollIntoView({ block: 'nearest' }); }, [latest]);
  async function preference(patch: { pinned?: boolean; muted?: boolean; archived?: boolean }) {
    if (!conversation) return;
    try { setError(''); await controller.preferences(conversation.id, patch); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Falha ao guardar preferências.'); }
  }
  if (!conversation) return <div className="flex h-full flex-col items-center justify-center bg-background p-8 text-center"><div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/[0.07] text-primary"><MessageSquare className="h-10 w-10" strokeWidth={1.5} /></div><h2 className="text-xl font-semibold tracking-tight">A conversa começa aqui</h2><p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">Escolhe alguém da equipa ou abre uma conversa para partilhar ideias, ficheiros e novidades.</p><Button className="mt-6 gap-2 rounded-2xl px-5 shadow-sm" onClick={onNew}><Plus className="h-4 w-4" />Nova conversa</Button></div>;
  const others = conversation.members.filter(member => member.id !== controller.userId);
  const typing = others.filter(member => member.typing_until && new Date(member.typing_until).getTime() > now);
  const active = others.filter(member => member.online_at && now - new Date(member.online_at).getTime() < 120000);
  const seen = others.map(member => member.online_at).filter((value): value is string => Boolean(value)).sort();
  const lastSeen = seen[seen.length - 1];
  const name = conversation.title || others.map(member => member.name).join(', ');
  const canSend = conversation.kind !== 'announcement' || conversation.members.some(member => member.id === controller.userId && member.role === 'owner');
  return <section className="flex h-full min-h-0 flex-col bg-background">
    <header className="shrink-0 border-b bg-card px-3 py-3 sm:px-5"><div className="flex items-center gap-3"><Button size="icon" variant="ghost" className="chat-thread-back h-10 w-10 shrink-0 rounded-xl md:hidden" aria-label="Voltar à lista de conversas" onClick={() => controller.select(null)}><ArrowLeft className="h-4 w-4" /></Button><PersonAvatar name={name} image={conversation.kind === 'direct' ? others[0]?.avatar : null} className="h-11 w-11 rounded-full" /><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold sm:text-base">{name}</h2><p className="mt-0.5 truncate text-xs text-muted-foreground">{typing.length ? `${typing.map(member => member.name).join(', ')} a escrever…` : active.length ? `${active.length} online` : lastSeen ? `Última atividade ${new Date(lastSeen).toLocaleString('pt-PT')}` : conversation.kind === 'direct' ? 'Equipa Perfect2Gether' : `${conversation.members.length} participantes`}</p></div>
      <Button size="icon" variant="ghost" className={`h-10 w-10 rounded-xl ${conversation.pinned ? 'text-primary' : 'text-muted-foreground'}`} title={conversation.pinned ? 'Desafixar conversa' : 'Fixar conversa'} aria-label={conversation.pinned ? 'Desafixar conversa' : 'Fixar conversa'} onClick={() => void preference({ pinned: !conversation.pinned })}><Pin className="h-4 w-4" /></Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-muted-foreground" aria-label="Opções da conversa"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setManage(true)}><Users className="mr-2 h-4 w-4" />Participantes</DropdownMenuItem><DropdownMenuItem onSelect={() => void preference({ muted: !conversation.muted })}><BellOff className="mr-2 h-4 w-4" />{conversation.muted ? 'Ativar notificações' : 'Silenciar conversa'}</DropdownMenuItem><DropdownMenuItem onSelect={() => void preference({ archived: !conversation.archived })}><Archive className="mr-2 h-4 w-4" />{conversation.archived ? 'Desarquivar' : 'Arquivar conversa'}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</header>
    {controller.viewingHistory && <div className="flex items-center justify-between border-b bg-accent px-4 py-2 text-xs"><span>Mensagem do histórico</span><Button variant="ghost" size="sm" onClick={() => controller.select(conversation.id)}>Voltar às mais recentes</Button></div>}
    <div ref={scroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-label="Histórico de mensagens">
      {controller.hasOlder && <div className="text-center"><Button variant="outline" disabled={controller.loadingMessages} onClick={() => void controller.loadOlder().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Não foi possível carregar o histórico.'))}>Carregar mensagens anteriores</Button></div>}
      {controller.loadingMessages && <p role="status" className="text-center text-sm text-muted-foreground">A carregar mensagens…</p>}
      {!controller.loadingMessages && !controller.messages.length && <p className="py-12 text-center text-sm text-muted-foreground">Diz olá e começa a conversa.</p>}
      {controller.messages.map((message, index) => { const day = new Date(message.created_at).toLocaleDateString('pt-PT'); const previous = controller.messages[index - 1]; return <Fragment key={message.id}>{(!previous || new Date(previous.created_at).toLocaleDateString('pt-PT') !== day) && <div className="py-2 text-center text-xs text-muted-foreground"><time dateTime={message.created_at}>{day}</time></div>}<MessageBubble message={message} controller={controller} onReply={id => { update({ reply: id }); draftInput.current?.focus(); }} /></Fragment>; })}<div ref={bottom} />
    </div>{canSend ? <Composer key={`composer-${conversation.id}`} inputRef={draftInput} controller={controller} reply={draft.reply} clearReply={() => update({ reply: null })} /> : <p className="border-t bg-card p-4 text-center text-sm text-muted-foreground">Só os responsáveis podem publicar neste anúncio.</p>}
    <ConversationDialog key={`members-${conversation.id}`} controller={controller} conversation={conversation} open={manage} close={() => setManage(false)} />
  </section>;
}




