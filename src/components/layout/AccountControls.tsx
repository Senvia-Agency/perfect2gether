import { useReleaseFeatures } from '@/hooks/useReleaseFeatures';
import { useState } from 'react';
import { Bell, LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTimeClock } from '@/modules/timeclock/useTimeClock';
import { clockApi } from '@/modules/timeclock/api';

export function AccountControls() {
  const { profile, signOut } = useAuth();
  const clock = useTimeClock();
  const { features } = useReleaseFeatures();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const notifications = clock.currentSnapshot?.notifications ?? [];
  const unread = notifications.filter(item => !item.read_at).length;
  async function read(id: string) {
    try { setError(''); await clockApi.call('notification_read', { org: clock.organizationId ?? '', id }); await clock.refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o aviso.'); }
  }
  async function logout() {
    try { await signOut(); navigate('/'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível terminar a sessão.'); }
  }
  return <div className="flex shrink-0 items-center gap-1.5">
    {features.timeclock && <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative rounded-full" aria-label={`Notificações de ponto${unread ? `: ${unread} por ler` : ''}`}><Bell className="h-4 w-4" />{!!unread && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{unread}</span>}</Button></PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="z-[85] max-h-[60dvh] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-2xl p-4"><h2 className="mb-3 text-sm font-semibold">Notificações de ponto</h2>{notifications.length ? <ul className="space-y-2">{notifications.map(item => <li key={item.id}><button onClick={() => void read(item.id)} className={`w-full rounded-xl p-3 text-left text-sm ${item.read_at ? 'bg-muted/40' : 'bg-accent'}`}><strong className="block font-medium">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.body}</span></button></li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">Não tem novos avisos de ponto.</p>}{error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}</PopoverContent>
    </Popover>}
    <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="rounded-full" aria-label="A minha conta"><Avatar className="h-8 w-8"><AvatarImage src={profile?.avatar_url ?? undefined} alt="" /><AvatarFallback className="bg-violet-100 text-xs text-violet-700">{profile?.full_name?.slice(0,2).toUpperCase() || <UserRound className="h-4 w-4" />}</AvatarFallback></Avatar></Button></PopoverTrigger>
      <PopoverContent align="end" className="z-[85] w-64 rounded-2xl p-4"><p className="truncate text-sm font-semibold">{profile?.full_name}</p><p className="mt-1 text-xs text-muted-foreground">A sua conta Perfect2Gether</p><Button variant="ghost" className="mt-3 w-full justify-start gap-2" onClick={() => void logout()}><LogOut className="h-4 w-4" />Terminar sessão</Button>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</PopoverContent>
    </Popover>
  </div>;
}
