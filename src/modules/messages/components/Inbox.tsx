import { useState } from 'react';
import { Archive, Bookmark, Inbox as InboxIcon, Megaphone, Pin, Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MessagesController } from '../useMessages';
import type { SearchResult } from '../types';
import { useMessageSearch } from './useMessageSearch';
import { PersonAvatar } from './PersonAvatar';

export function Inbox({ controller, onNew, kind }: { readonly controller: MessagesController; readonly onNew: () => void; readonly kind: string }) {
  const { query, changeQuery, results, search, cancel, searching, error: searchError } = useMessageSearch(controller);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  async function jump(result: SearchResult) {
    try { setError(''); await controller.jump(result); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível abrir a mensagem.'); }
  }
  async function loadSaved() {
    try { setError(''); await controller.loadSaved(); setFilter('saved'); cancel(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível carregar os guardados.'); }
  }
  const conversations = controller.snapshot?.conversations ?? [];
  const unread = conversations.filter(item => !item.archived).reduce((sum, item) => sum + item.unread, 0);
  const availableResults = results?.filter(result => conversations.some(item => item.id === result.conversation_id));
  const visible = conversations.filter(item => (filter === 'archived' ? item.archived : !item.archived) && (filter !== 'unread' || item.unread > 0) && (kind === 'all' || item.kind === kind) && (!query.trim() || [item.title, ...item.members.map(member => member.name)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
  return <aside className="flex h-full min-h-0 flex-col bg-card">
    <div className="space-y-4 border-b p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold tracking-tight">Mensagens</h2><Button size="icon" variant="ghost" aria-label="Nova conversa" className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:text-primary-foreground" onClick={onNew}><Plus className="h-4 w-4" /></Button></div>
      <form className="relative" onSubmit={event => { event.preventDefault(); setFilter('all'); setError(''); search(); }}><Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" /><Input id="messages-search" aria-label="Pesquisar pessoas, conversas e mensagens" placeholder="Procurar pessoa ou conversa…" value={query} onChange={event => { setError(''); changeQuery(event.target.value); }} className="h-10 rounded-xl bg-muted/35 pl-10 pr-11 shadow-none" /><Button type="submit" size="icon" variant="ghost" aria-label="Procurar mensagens" className="absolute right-1 top-1 h-8 w-8 rounded-lg" disabled={searching || !query.trim()}><Search className="h-3.5 w-3.5" /></Button></form>
      <div className="flex items-center gap-1" aria-label="Filtrar conversas">{[{ id: 'all', label: 'Todas' }, { id: 'unread', label: `Não lidas${unread ? ` (${unread})` : ''}` }].map(item => <Button key={item.id} size="sm" variant="ghost" aria-pressed={filter === item.id} className={`rounded-full px-3 text-xs ${filter === item.id ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'}`} onClick={() => { setFilter(item.id); cancel(); }}>{item.label}</Button>)}<Button size="icon" variant="ghost" aria-label="Mensagens guardadas" title="Mensagens guardadas" className={`ml-auto h-8 w-8 rounded-lg ${filter === 'saved' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} onClick={() => void loadSaved()}><Bookmark className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Conversas arquivadas" title="Arquivadas" className={`h-8 w-8 rounded-lg ${filter === 'archived' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} onClick={() => { setFilter('archived'); cancel(); }}><Archive className="h-4 w-4" /></Button></div>

    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">{(error || searchError) && <p role="alert" className="p-3 text-sm text-destructive">{error || searchError}</p>}{searching && <p role="status" className="p-3 text-sm text-muted-foreground">A pesquisar…</p>}
      {filter === 'saved' ? controller.saved.map(message => <button type="button" key={message.id} className="mb-1 min-h-16 w-full rounded-xl p-3 text-left text-sm hover:bg-muted" onClick={() => void jump({ conversation_id: message.conversation_id, message_id: message.id, body: message.body })}><Bookmark className="mb-1 h-3.5 w-3.5 text-primary" /><span className="line-clamp-2">{message.body || 'Anexo guardado'}</span></button>) : results ? <><div className="p-3 text-xs text-muted-foreground">{availableResults?.length} resultados</div>{availableResults?.map(result => <button type="button" key={result.message_id} className="mb-1 min-h-16 w-full rounded-xl p-3 text-left hover:bg-muted" onClick={() => void jump(result)}><span className="mb-1 block text-xs font-medium text-primary">{conversations.find(item => item.id === result.conversation_id)?.title}</span><span className="line-clamp-3 break-words text-sm">{result.body || 'Anexo'}</span></button>)}</> : visible.map(item => {
        const name = item.title || item.members.filter(member => member.id !== controller.userId).map(member => member.name).join(', ');
        const selected = controller.selectedId === item.id;
        return <button type="button" key={item.id} aria-current={selected ? 'true' : undefined} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${selected ? 'bg-primary/[0.08]' : 'hover:bg-muted/60'}`} onClick={() => controller.select(item.id)}>
          {item.kind === 'direct' ? <PersonAvatar name={name} image={item.members.find(member => member.id !== controller.userId)?.avatar} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">{item.kind === 'announcement' ? <Megaphone className="h-5 w-5" /> : <Users className="h-5 w-5" />}</span>}
          <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{name}</span>{item.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Conversa fixada" />}</div><p className="mt-1 truncate text-xs text-muted-foreground">{item.muted && 'Silenciada · '}{item.last_message || 'Começa a conversa'}</p></div>
          {item.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground" aria-label={`${item.unread} mensagens não lidas`}>{item.unread}</span>}
        </button>;
      })}
      {((!results && filter !== 'saved' && !visible.length) || (filter === 'saved' && !controller.saved.length)) && <div className="flex flex-col items-center gap-3 px-4 py-12 text-center"><InboxIcon className="h-7 w-7 text-muted-foreground/60" /><p className="text-sm font-medium">{filter === 'saved' ? 'Ainda sem mensagens guardadas' : filter === 'unread' ? 'Está tudo em dia' : filter === 'archived' ? 'Sem conversas arquivadas' : 'A tua próxima conversa começa aqui'}</p><p className="max-w-52 text-xs leading-relaxed text-muted-foreground">{filter === 'saved' ? 'Guarda uma mensagem para a encontrares aqui.' : 'Abre uma conversa com alguém da equipa.'}</p>{filter === 'all' && <Button size="sm" variant="outline" className="mt-1 rounded-xl" onClick={onNew}>Iniciar conversa</Button>}</div>}
    </div>
  </aside>;
}
