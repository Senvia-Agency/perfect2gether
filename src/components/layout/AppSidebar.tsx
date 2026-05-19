import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Settings, LogOut, Shield, Calendar, FileText, ShoppingBag, Store, UserCheck, Mail, Wallet, Lock, Search, Building2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useModules, EnabledModules } from "@/hooks/useModules";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscription } from "@/hooks/useSubscription";
import { APP_VERSION } from "@/lib/constants";
import type { AppRole } from "@/types";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { hasPerfect2GetherAccess } from "@/lib/perfect2gether";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  moduleKey?: keyof EnabledModules;
  permissionKey?: string;
  isAdminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Painel" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/clients", icon: UserCheck, label: "Clientes", moduleKey: 'clients' },
  { to: "/proposals", icon: FileText, label: "Propostas", moduleKey: 'proposals' },
  { to: "/sales", icon: ShoppingBag, label: "Vendas", moduleKey: 'sales' },
  { to: "/financeiro", icon: Wallet, label: "Financeiro", moduleKey: 'finance' },
  { to: "/calendar", icon: Calendar, label: "Agenda", moduleKey: 'calendar' },
  { to: "/marketing", icon: Mail, label: "Marketing", moduleKey: 'marketing' },
  { to: "/prospects", icon: Search, label: "Prospects", moduleKey: 'prospects' },
  { to: "/ecommerce", icon: Store, label: "E-commerce", moduleKey: 'ecommerce' },
  { to: "/settings", icon: Settings, label: "Definições", isAdminOnly: true },
  { to: "/gestao", icon: BarChart3, label: "Gestão", permissionKey: 'gestao' },
];

const getRoleLabel = (roles: AppRole[]): string => {
  if (roles.includes('super_admin')) return 'Super Admin';
  if (roles.includes('admin')) return 'Administrador';
  if (roles.includes('viewer')) return 'Visualizador';
  return 'Colaborador';
};

interface AppSidebarProps {
  userName?: string;
  organizationName?: string;
}

export function AppSidebar({
  userName = "Utilizador",
  organizationName = "A Minha Empresa"
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, roles, isSuperAdmin, organization, organizations } = useAuth();
  const { isAdmin, canViewModule, systems } = usePermissions();
  const { modules } = useModules();
  const { isModuleLocked, getRequiredPlan } = useSubscription();
  const hasPerfect2GetherModuleAccess = hasPerfect2GetherAccess({
    organizationId: organization?.id,
    memberships: organizations,
    isSuperAdmin,
  });

  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; feature: string; plan: string }>({
    open: false, feature: '', plan: ''
  });

  const isTotalLinkOnly = systems.length === 1 && systems[0] === 'total_link';

  const navItems = isTotalLinkOnly
    ? [] // Total Link users only see the portal, injected below
    : allNavItems.filter(item => {
        if (item.isAdminOnly && !isAdmin && !isSuperAdmin) return false;
        if (item.permissionKey && !canViewModule(item.permissionKey)) return false;
        if (!item.moduleKey) return true;
        if (isModuleLocked(item.moduleKey)) return true;
        if (!modules[item.moduleKey]) return false;
        if (!canViewModule(item.moduleKey)) return false;
        return true;
      });

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleLockedClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.moduleKey && isModuleLocked(item.moduleKey)) {
      e.preventDefault();
      setUpgradeModal({
        open: true,
        feature: item.label,
        plan: getRequiredPlan(item.moduleKey),
      });
    }
  };

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 gradient-sidebar border-r border-sidebar-border">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b border-sidebar-border px-4">
            <img 
              alt={organization?.name || "Perfect2Gether"}
              className="h-10 w-40 object-contain" 
              src="/Logo-P2G.png" 
            />
          </div>

          <div className="border-b border-sidebar-border px-3 py-3">
            <OrganizationSwitcher />
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map(item => {
              const locked = item.moduleKey ? isModuleLocked(item.moduleKey) : false;
              const isActive = location.pathname === item.to || item.to !== "/dashboard" && location.pathname.startsWith(item.to);
              
              return (
                <NavLink
                  key={item.to}
                  to={locked ? "#" : item.to}
                  onClick={(e) => handleLockedClick(e, item)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    locked
                      ? "cursor-pointer text-sidebar-muted/50 hover:bg-sidebar-accent/30"
                      : isActive
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {locked && <Lock className="h-3.5 w-3.5 text-sidebar-muted/60" />}
                </NavLink>
              );
            })}

            {(isTotalLinkOnly || hasPerfect2GetherModuleAccess || canViewModule('portal_total_link')) && (
              <NavLink
                to="/portal-total-link"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  location.pathname.startsWith("/portal-total-link")
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Building2 className="h-5 w-5" />
                Portal Total Link
              </NavLink>
            )}
            
            {isSuperAdmin && !isTotalLinkOnly && (
              <NavLink
                to="/system-admin"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  location.pathname.startsWith("/system-admin")
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Shield className="h-5 w-5" />
                System Admin
              </NavLink>
            )}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-foreground">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {userName}
                </p>
                <p className="text-xs text-sidebar-muted">{getRoleLabel(roles)}</p>
              </div>
              <button onClick={handleLogout} className="rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" title="Terminar sessão">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-4 py-2 text-center">
            <NavLink to="/notas-atualizacao" className="text-[10px] text-sidebar-muted/60 hover:text-sidebar-foreground transition-colors">
              Perfect2Gether v{APP_VERSION}
            </NavLink>
          </div>
        </div>
      </aside>

      <UpgradeModal
        open={upgradeModal.open}
        onOpenChange={(open) => setUpgradeModal(prev => ({ ...prev, open }))}
        featureName={upgradeModal.feature}
        requiredPlan={upgradeModal.plan}
      />
    </>
  );
}
