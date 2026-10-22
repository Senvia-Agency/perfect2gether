import { useState } from 'react';
import { Home, LockKeyhole, Megaphone, MessageSquare, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessages } from './useMessages';
import { Inbox } from './components/Inbox';
import { Thread } from './components/Thread';
import { MessageDrafts } from './components/MessageDrafts';
import { ConversationDialog } from './components/ConversationDialog';
import { ColleagueDirectory } from './components/ColleagueDirectory';
import { PushPrompt } from './components/PushPrompt';
import './messages.css';

const views = [
  { id: 'all', label: 'Todas', icon: Home, color: 'from-violet-400 to-indigo-500' },
  { id: 'direct', label: 'Privadas', icon: UserRound, color: 'from-sky-400 to-blue-500' },
  { id: 'group', label: 'Grupos', icon: Users, color: 'from-teal-300 to-emerald-500' },
  { id: 'announcement', label: 'Anúncios', icon: Megaphone, color: 'from-amber-300 to-orange-500' },
  { id: 'people', label: 'Equipa', icon: Users, color: 'from-fuchsia-400 to-purple-500' },
] as const;

export function MessagesWorkspace() {
  const controller = useMessages();
  const [view, setView] = useState<typeof views[number]['id']>('all');
  const [creating, setCreating] = useState(false);
  if (controller.isLoading) return <div className="flex min-h-96 items-center justify-center p-6" role="status">A carregar mensagens…</div>;
  if (controller.error && !controller.snapshot) return <div className="m-4 rounded-2xl border bg-card p-6 md:m-6"><h1 className="text-2xl font-semibold">Mensagens indisponíveis</h1><p role="alert" className="my-4 break-words text-sm text-destructive">{controller.error.message}</p><Button onClick={controller.reload}>Tentar novamente</Button></div>;
  function choose(next: typeof view) { setView(next); if (next === 'people') controller.select(null); }
  return <MessageDrafts key={`${controller.orgId}:${controller.userId}`} conversations={controller.snapshot?.conversations.map(item => item.id) ?? []}>
    <main className="messages-theme chat-workspace p-3 md:p-5 lg:p-6">
      <div className="flex h-[calc(100dvh-10rem)] min-h-[30rem] flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm md:h-[calc(100dvh-6.5rem)]">
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-muted/80 px-3">
          <div className="flex h-full items-end"><button type="button" onClick={() => choose('all')} className="flex h-10 items-center gap-2 rounded-t-2xl bg-card px-4 text-sm font-medium"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 text-white"><MessageSquare className="h-3.5 w-3.5" /></span>Mensagens</button></div>
          <span className="mr-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><LockKeyhole className="h-3 w-3" /><span className="hidden sm:inline">Conversas privadas da equipa</span></span>
        </header>
        <PushPrompt />
        <div className="chat-workspace-panes flex min-h-0 flex-1 flex-col md:flex-row" data-conversation-open={Boolean(controller.selectedId)}>
          <nav aria-label="Categorias de mensagens" className={`chat-categories flex shrink-0 gap-1 overflow-x-auto border-b bg-background px-2 py-2 md:w-[76px] md:flex-col md:gap-2 md:border-b-0 md:border-r md:px-1.5 md:py-3 ${controller.selectedId ? 'hidden md:flex' : ''}`}>
            {views.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => choose(item.id)} className={`flex min-w-16 flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === item.id ? 'border-primary/20 bg-primary/[0.06] text-primary' : 'border-transparent text-muted-foreground hover:bg-muted'}`}><span className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ${item.color}`}><item.icon className="h-5 w-5" strokeWidth={1.8} /></span>{item.label}</button>)}
          </nav>
          {view === 'people' ? <div className="min-h-0 min-w-0 flex-1 overflow-y-auto"><ColleagueDirectory controller={controller} onOpen={() => setView('all')} /></div> : <div className="chat-conversation-panes grid min-h-0 min-w-0 flex-1 md:grid-cols-[20rem_minmax(0,1fr)] lg:grid-cols-[21rem_minmax(0,1fr)]">
            <div className={`chat-inbox min-h-0 border-r ${controller.selectedId ? 'hidden md:block' : ''}`}><Inbox key={`${controller.orgId}:${controller.userId}`} controller={controller} onNew={() => setCreating(true)} kind={view} /></div>
            <div className={`chat-thread min-h-0 min-w-0 ${controller.selectedId ? '' : 'hidden md:block'}`}><Thread key={controller.selectedId} controller={controller} onNew={() => setCreating(true)} /></div>
          </div>}
        </div>
      </div>
      <ConversationDialog controller={controller} open={creating} close={() => setCreating(false)} />
    </main>
  </MessageDrafts>;
}
