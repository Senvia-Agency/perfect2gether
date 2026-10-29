import { ClockWidget } from "@/modules/timeclock/components/ClockWidget";
import { AccountControls } from "./AccountControls";
import { useAuth } from "@/contexts/AuthContext";
import './navigation.css';
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  organizationName?: string;
}

export function MobileHeader({
  onMenuToggle,
  organizationName = "Perfect2Gether"
}: MobileHeaderProps) {
  const { organization } = useAuth();

  return (
    <header className="pointer-events-auto fixed top-0 left-0 right-0 z-[60] p2g-navigation border-b safe-top">
      <div className="h-14 flex items-center justify-between gap-2 px-3">
        <Button variant="ghost" size="icon" onClick={onMenuToggle} className="rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        <img
          alt={organization?.name || "Perfect2Gether"}
          className="h-7 w-20 min-w-0 object-contain"
          src="/logo-p2gether.png"
        />
        <div className="ml-auto flex shrink-0 items-center gap-1"><ClockWidget /><AccountControls /></div>
      </div>
    </header>
  );
}
