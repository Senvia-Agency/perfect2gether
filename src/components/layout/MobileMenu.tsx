import { NavLink, useNavigate } from "react-router-dom";
import { ArrowRightLeft, LogOut, X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavItems, NavItem } from "@/hooks/useNavItems";
import { APP_VERSION } from "@/lib/constants";
import { getRoleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { isPerfect2GetherOrg } from "@/lib/perfect2gether";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  organizationName?: string;
}

export function MobileMenu({ isOpen, onClose, userName = "Utilizador", organizationName = "A Minha Empresa" }: MobileMenuProps) {
  const navigate = useNavigate();
  const { signOut, roles, organization } = useAuth();
  const { profileName, hasSystem } = usePermissions();
  const { items } = useNavItems();
  // "Definições" fica de fora do menu hambúrguer (continua na barra inferior).
  const navItems = items.filter((item) => item.to !== "/settings");

  const handleLogout = async () => {
    await signOut();
    navigate('/');
    onClose();
  };

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    // Módulo bloqueado pelo plano: não navega (mantém o menu aberto, com cadeado).
    if (item.locked) {
      e.preventDefault();
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    // z-[70]: o menu cobre o cabeçalho (z-60) e a barra inferior (z-50) — caso
    // contrário a barra inferior tapava o botão "Terminar Sessão".
    <div className="fixed inset-0 z-[70] bg-background animate-in slide-in-from-left duration-200">
      {/* Close button area - respects safe area */}
      <div className="flex items-center justify-end px-4" style={{ paddingTop: 'calc(clamp(20px, env(safe-area-inset-top, 0px), 50px) + 0.5rem)', minHeight: '3.5rem' }}>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col h-[calc(100%-3.5rem)] px-6 pb-safe">
        {/* User Info */}
        <div className="flex items-center gap-4 py-6 border-b border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate font-medium text-foreground">
              {userName}
            </p>
            <p className="text-sm text-muted-foreground">{getRoleLabel({ roles, profileName })}</p>
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {organizationName}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.locked ? "#" : item.to}
              onClick={(e) => handleNavClick(e, item)}
              className={({ isActive }) => cn(
                "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                item.locked
                  ? "text-muted-foreground/50"
                  : isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.locked && <Lock className="h-4 w-4 text-muted-foreground/60" />}
            </NavLink>
          ))}
          {isPerfect2GetherOrg(organization?.id) && hasSystem('total_link') && (
            <NavLink
              to="/portal-total-link/home"
              onClick={onClose}
              className="flex min-h-11 items-center gap-4 rounded-xl border-t border-border px-4 py-3.5 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
              <span>Ir para Total Link</span>
            </NavLink>
          )}
        </nav>

        {/* Logout & Version */}
        <div className="py-6 border-t border-border space-y-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 w-full rounded-xl px-4 py-3.5 text-base font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Terminar Sessão
          </button>

          <p className="text-center text-xs text-muted-foreground/50">
            Perfect2Gether v{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
