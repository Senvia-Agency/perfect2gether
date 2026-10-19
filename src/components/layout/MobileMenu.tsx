import { NavigationSections } from './NavigationSections';
import { useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { ArrowRightLeft, LogOut, X, Lock } from "lucide-react";
import { NavigationIcon } from './NavigationIcon';
import './navigation.css';
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
  const opener = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { signOut, roles, organization } = useAuth();
  const { profileName, hasSystem } = usePermissions();
  const { primarySections, secondarySections } = useNavItems();
  const location = useLocation();

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



  return (
    // z-[70]: o menu cobre o cabeçalho (z-60) e a barra inferior (z-50) — caso
    // contrário a barra inferior tapava o botão "Terminar Sessão".
    <DialogPrimitive.Root open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/20" />
      <DialogPrimitive.Content
        onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}
        aria-describedby={undefined} className="fixed inset-0 z-[71] p2g-navigation flex flex-col animate-in slide-in-from-left duration-200 motion-reduce:animate-none">
      <DialogPrimitive.Title className="sr-only">Menu principal</DialogPrimitive.Title>
      {/* Close button area - respects safe area */}
      <div className="flex items-center justify-end px-4" style={{ paddingTop: 'calc(clamp(20px, env(safe-area-inset-top, 0px), 50px) + 0.5rem)', minHeight: '3.5rem' }}>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar menu">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-safe">
        {/* User Info */}
        <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900/30 dark:bg-violet-950/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-lg font-semibold text-white">
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
        <nav className="min-h-0 flex-1 overflow-y-auto py-4 space-y-1">
          <NavigationSections primary={primarySections} secondary={secondarySections} pathname={location.pathname} renderItem={item => (
            <NavLink
              key={item.to}
                  data-locked={item.locked ? 'true' : undefined}
              to={item.locked ? "#" : item.to}
              onClick={(e) => handleNavClick(e, item)}
              className={({ isActive }) => cn(
                "p2g-nav-link flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium",
                item.locked
                  ? "text-muted-foreground/50"
                  : isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <NavigationIcon icon={item.icon} route={item.to} locked={item.locked} />
              <span className="flex-1">{item.label}</span>
                  {!!item.unread && <span className="p2g-nav-badge rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground" aria-label={`${item.unread} mensagens não lidas`}>{item.unread}</span>}
              {item.locked && <Lock className="h-4 w-4 text-muted-foreground/60" />}
            </NavLink>
          )} />
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
        <div className="shrink-0 py-3 border-t border-border space-y-2">
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
    </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
