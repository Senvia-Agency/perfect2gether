import { useState } from 'react';
import { BellRing, Loader2, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const DISMISSED_KEY = 'messages-push-prompt-dismissed-v1';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isSnoozed(): boolean {
  const at = Number(localStorage.getItem(DISMISSED_KEY));
  return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
}

export function PushPrompt() {
  const push = usePushNotifications();
  const { isIOS, isInstalled } = usePWAInstall();
  const [hidden, setHidden] = useState(isSnoozed);
  const [activating, setActivating] = useState(false);

  // While the initial subscription check runs, render nothing to avoid a flash.
  if (hidden || push.isSubscribed || (push.isLoading && !activating)) return null;

  // iPhone/iPad only allow web push from the app added to the home screen.
  const needsInstall = isIOS && !isInstalled;
  if (!needsInstall && !push.isSupported) return null;

  async function activate() {
    setActivating(true);
    try { await push.subscribe(); } finally { setActivating(false); }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setHidden(true);
  }

  let text: string;
  if (needsInstall) text = 'Para receberes notificações no iPhone, toca em Partilhar e depois em "Adicionar ao ecrã principal". Abre a app a partir desse ícone e ativa aqui.';
  else if (push.permission === 'denied') text = 'As notificações estão bloqueadas neste browser. Permite-as nas definições do site (ícone do cadeado junto ao endereço) e recarrega a página.';
  else text = 'Ativa as notificações para saberes quando chegam mensagens novas, neste dispositivo.';

  const canActivate = !needsInstall && push.permission !== 'denied';

  return <div role="status" className="flex shrink-0 items-center gap-3 border-b bg-primary/[0.06] px-3 py-2 text-sm">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 text-white">
      {needsInstall ? <Share className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
    </span>
    <p className="min-w-0 flex-1 text-xs text-foreground sm:text-sm">{text}</p>
    {canActivate && <Button size="sm" className="shrink-0" onClick={activate} disabled={activating}>
      {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar'}
    </Button>}
    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={dismiss} aria-label="Lembrar mais tarde">
      <X className="h-4 w-4" />
    </Button>
  </div>;
}
