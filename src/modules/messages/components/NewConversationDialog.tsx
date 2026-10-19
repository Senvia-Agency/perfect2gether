import { useState } from 'react';
import { Megaphone, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { MessagesController } from '../useMessages';
import { ParticipantPicker } from './ParticipantPicker';
import { PersonAvatar } from './PersonAvatar';

export function NewConversationDialog({ controller, open, close }: { readonly controller: MessagesController; readonly open: boolean; readonly close: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [announcement, setAnnouncement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const people = controller.snapshot?.people.filter((person): person is { id: string; name: string; avatar?: string | null } => typeof person.id === 'string' && typeof person.name === 'string').filter(person => person.id !== controller.userId).sort((a, b) => a.name.localeCompare(b.name, 'pt')) ?? [];
  const chosen = people.filter(person => selected.includes(person.id));
  const group = selected.length > 1;
  const defaultName = chosen.map(person => person.name.trim().split(/\s+/)[0]).join(' e ').slice(0, 200);
  const kind = announcement ? 'announcement' : group ? 'group' : 'direct';
  function dismiss() { if (!busy) { setSelected([]); setTitle(''); setError(''); setAnnouncement(false); close(); } }
  async function create() {
    if (busy || !selected.length) return;
    setBusy(true); setError('');
    try { await controller.create({ org: controller.orgId, kind, title: kind === 'direct' ? '' : title.trim() || defaultName, participants: selected }); setBusy(false); setSelected([]); setTitle(''); setAnnouncement(false); close(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível criar a conversa.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value) dismiss(); }}><DialogContent overlayClassName="z-[80]" className="messages-theme z-[90] !top-1/2 !-translate-y-1/2 !max-h-[calc(100dvh-2rem)] flex h-[min(48rem,calc(100dvh-2rem))] !max-w-[28rem] flex-col gap-0 overflow-hidden rounded-[1.75rem] bg-card p-0" style={{ width: 'calc(100vw - 2rem)' }}>
    <header className="shrink-0 px-6 pb-3 pt-6"><DialogTitle className="text-xl font-semibold tracking-tight">Nova conversa</DialogTitle><DialogDescription className="mt-1.5 text-sm">Escolhe um colega, ou vários para criar um grupo.</DialogDescription></header>
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-0">
      {(group || announcement) && <section className="mx-2 shrink-0 space-y-2 rounded-2xl border border-primary/15 bg-primary/[0.06] p-3" aria-label="Detalhes do grupo">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">{announcement ? <Megaphone className="h-4 w-4" /> : <Users className="h-4 w-4" />}{announcement ? 'Novo anúncio' : 'Novo grupo'} · {selected.length} {selected.length === 1 ? 'colega' : 'colegas'}</p>
        <Input aria-label="Nome do grupo" placeholder={announcement ? 'Dá um nome ao anúncio' : 'Dá um nome ao grupo'} value={title} maxLength={200} disabled={busy} onChange={event => setTitle(event.target.value)} className="h-12 rounded-xl border-primary/30 bg-card shadow-none" />
        <p className="text-xs text-muted-foreground">Opcional. Se não escreveres, fica <strong className="font-medium text-foreground">{defaultName || 'o nome dos colegas'}</strong>.</p>
        <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">{chosen.map(person => <button key={person.id} type="button" disabled={busy} aria-label={`Retirar ${person.name}`} onClick={() => setSelected(selected.filter(id => id !== person.id))} className="flex min-h-9 items-center gap-1 rounded-full border bg-card py-1 pl-1 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><PersonAvatar name={person.name} image={person.avatar} colorful className="h-6 w-6 text-[10px]" />{person.name.split(' ')[0]}<X className="ml-0.5 h-3 w-3 text-muted-foreground" /></button>)}</div>
      </section>}
      <ParticipantPicker compact people={people} selected={selected} change={setSelected} single={false} disabled={busy} />
      {error && <p role="alert" className="shrink-0 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
    </div>
    <footer className="shrink-0 space-y-2 border-t bg-card px-4 pb-4 pt-3">
      {controller.snapshot?.can_announce && <button type="button" aria-pressed={announcement} disabled={busy} onClick={() => setAnnouncement(!announcement)} className={`flex min-h-8 items-center gap-1.5 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${announcement ? 'font-medium text-primary' : 'text-muted-foreground'}`}><Megaphone className="h-3.5 w-3.5" />{announcement ? 'Anúncio selecionado · mudar para conversa' : 'Criar anúncio para a equipa'}</button>}
      <Button className="h-12 w-full rounded-full font-semibold" disabled={busy || !selected.length} onClick={() => void create()}>{busy ? 'A criar…' : announcement ? `Criar anúncio com ${selected.length} ${selected.length === 1 ? 'colega' : 'colegas'}` : group ? `Criar grupo com ${selected.length} colegas` : 'Começar conversa'}</Button>
    </footer>
  </DialogContent></Dialog>;
}
