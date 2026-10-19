import { useAuth } from "@/contexts/AuthContext";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LegacyMobileHeaderProps {
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  organizationName?: string;
}

export function LegacyMobileHeader({
  onMenuToggle,
  organizationName = "Perfect2Gether"
}: LegacyMobileHeaderProps) {
  const { organization } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] bg-background border-b border-border safe-top">
      <div className="h-14 flex items-center justify-between px-4">
        <Button variant="ghost" size="icon" onClick={onMenuToggle} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        <img 
          alt={organization?.name || "Perfect2Gether"}
          className="h-8 w-28 object-contain" 
          src="/logo-p2gether.png" 
        />
        <div className="w-10" />
      </div>
    </header>
  );
}