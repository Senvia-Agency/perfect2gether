import { useAuth } from '@/contexts/AuthContext';
import { ClockWidget } from '@/modules/timeclock/components/ClockWidget';
import { AccountControls } from './AccountControls';

export function AppHeader() {
  const { organization } = useAuth();
  return <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between gap-4 border-b bg-card/95 px-6 backdrop-blur-sm" aria-label="Barra da equipa">
    <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{organization?.name}</p>
    <div className="flex shrink-0 items-center gap-3"><ClockWidget /><AccountControls /></div>
  </header>;
}
