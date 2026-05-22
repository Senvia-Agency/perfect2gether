import { NavLink, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  Shield,
  X,
  Building2,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { APP_VERSION } from "@/lib/constants";
import { getRoleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Painel" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/settings", icon: Settings, label: "Definições" },
];

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  organizationName?: string;
}

export function MobileMenu({ isOpen, onClose, userName = "Utilizador", organizationName = "A Minha Empresa" }: MobileMenuProps) {
  const navigate = useNavigate();
  const { signOut, roles, isSuperAdmin, organization } = useAuth();
  const { canViewModule, systems, profileName } = usePermissions();
  const isTotalLinkOnly = systems.length === 1 && systems[0] === 'total_link';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
    onClose();
  };

  const handleNavClick = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-background animate-in slide-in-from-left duration-200">
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
        <nav className="flex-1 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={({ isActive }) => cn(
                "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
          
          {(isTotalLinkOnly || canViewModule('portal_total_link')) && (
            <NavLink
              to="/portal-total-link"
              onClick={handleNavClick}
              className={({ isActive }) => cn(
                "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Building2 className="h-5 w-5" />
              Portal Total Link
            </NavLink>
          )}

          {isSuperAdmin && (
            <NavLink
              to="/system-admin"
              onClick={handleNavClick}
              className={({ isActive }) => cn(
                "flex items-center gap-4 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Shield className="h-5 w-5" />
              System Admin
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
