import { MessageCircle, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { MessagesController } from '../useMessages';

const colors = ['bg-teal-500', 'bg-blue-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-600'];
export function ColleagueDirectory({ controller, onOpen }: { readonly controller: MessagesController; readonly onOpen: () => void }) {
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const people = controller.snapshot?.people.filter(person => person.id !== controller.userId) ?? [];
  const filtered = people.filter(person => person.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  async function open(person: typeof people[number]) {
    if (opening) return;
    const existing = controller.snapshot?.conversations.find(item => item.kind === 'direct' && item.members.some(member => member.id === person.id));
    if (existing) { controller.select(existing.id); onOpen(); return; }
    try { setError(''); setOpening(person.id); const id = await controller.create({ org: controller.orgId, kind: 'direct', title: '', participants: [person.id] }); controller.select(id); onOpen(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível abrir a conversa.'); }
    finally { setOpening(null); }
  }
  return <section className="space-y-6 rounded-3xl border border-border/70 bg-muted/30 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-2xl font-semibold tracking-tight">Colaboradores</h2><p className="mt-1 text-sm text-muted-foreground">{people.length} {people.length === 1 ? 'pessoa na tua equipa' : 'pessoas na tua equipa'}</p></div>
      <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Pesquisar colaboradores" placeholder="Pesquisar pelo nome…" value={query} onChange={event => setQuery(event.target.value)} className="h-12 rounded-full bg-card pl-11 shadow-none" /></div>
    </div>
    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-3 lg:grid-cols-2">
      {filtered.map((person, index) => <div key={person.id} className="group flex items-center gap-4 rounded-3xl border border-border/80 bg-card p-4 shadow-sm transition-colors hover:border-primary/30 sm:p-5">
        <Avatar className="h-14 w-14 shrink-0"><AvatarImage src={person.avatar ?? undefined} alt="" /><AvatarFallback className={`${colors[index % colors.length]} text-base font-semibold text-white`}>{person.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold leading-snug sm:text-base">{person.name}</h3><p className="mt-1 text-sm text-muted-foreground">Equipa Perfect2Gether</p></div>
        <Button variant="ghost" size="icon" aria-label={`Conversar com ${person.name}`} title={`Conversar com ${person.name}`} disabled={opening !== null} onClick={() => void open(person)} className="h-11 w-11 shrink-0 rounded-full bg-primary/[0.07] text-primary hover:bg-primary hover:text-primary-foreground"><MessageCircle className={`h-5 w-5 ${opening === person.id ? 'animate-pulse motion-reduce:animate-none' : ''}`} /></Button>
      </div>)}
    </div>
    {!filtered.length && <div className="flex flex-col items-center gap-3 py-14 text-center"><Users className="h-8 w-8 text-muted-foreground" /><p className="font-medium">{people.length ? 'Não encontrámos esse nome' : 'A tua equipa aparece aqui'}</p><p className="max-w-xs text-sm text-muted-foreground">{people.length ? 'Tenta pesquisar outro nome.' : 'Os membros ativos da organização ficam disponíveis para conversar.'}</p></div>}
  </section>;
}
