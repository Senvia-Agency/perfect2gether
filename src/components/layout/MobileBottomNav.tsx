import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Settings, Shield, Calendar, FileText, ShoppingBag, Store, UserCheck, Mail, Wallet, Lock, Building2, Search, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useModules, EnabledModules } from "@/hooks/useModules";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/shared/UpgradeModal";


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
  { to: "/financeiro", icon: Wallet, label: "Finanças", moduleKey: 'finance' },
  { to: "/calendar", icon: Calendar, label: "Agenda", moduleKey: 'calendar' },
  { to: "/marketing", icon: Mail, label: "Marketing", moduleKey: 'marketing' },
  { to: "/prospects", icon: Search, label: "Prospects", moduleKey: 'prospects' },
  { to: "/ecommerce", icon: Store, label: "Loja", moduleKey: 'ecommerce' },
  { to: "/settings", icon: Settings, label: "Definições", isAdminOnly: true },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { isSuperAdmin } = useAuth();
  const { modules } = useModules();
  const { canViewModule, isAdmin, systems } = usePermissions();
  const { isModuleLocked, getRequiredPlan } = useSubscription();

  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; feature: string; plan: string }>({
    open: false, feature: '', plan: ''
  });

  const isTotalLinkOnly = systems.length === 1 && systems[0] === 'total_link';

  // Plan-locked items stay visible; admin-disabled or no-permission items are hidden
  const navItems = isTotalLinkOnly
    ? []
    : allNavItems.filter(item => {
        if (item.isAdminOnly && !isAdmin && !isSuperAdmin) return false;
        if (!item.moduleKey) return true;
        if (isModuleLocked(item.moduleKey)) return true;
        if (!modules[item.moduleKey]) return false;
        if (!canViewModule(item.moduleKey)) return false;
        return true;
      });

  const portalItems: NavItem[] = (isTotalLinkOnly || canViewModule('portal_total_link'))
    ? [{ to: "/portal-total-link", icon: Building2, label: "Portal" }]
    : [];

  const gestaoVisible = !isTotalLinkOnly && canViewModule('gestao');
  const adminItems = gestaoVisible
    ? [{ to: "/gestao", icon: BarChart3, label: "Gestão" }]
    : [];

  const allItems = isSuperAdmin && !isTotalLinkOnly
    ? [...navItems, ...portalItems, ...adminItems, { to: "/system-admin", icon: Shield, label: "Admin" }]
    : [...navItems, ...portalItems, ...adminItems];

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
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-bottom overflow-hidden">
        <div className="flex items-center h-16 px-2 overflow-x-auto no-scrollbar gap-1">
          {allItems.map((item) => {
            const locked = 'moduleKey' in item && item.moduleKey ? isModuleLocked(item.moduleKey) : false;
            const isActive = location.pathname === item.to || 
              (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            
            return (
              <NavLink
                key={item.to}
                to={locked ? "#" : item.to}
                onClick={(e) => 'moduleKey' in item ? handleLockedClick(e, item as NavItem) : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px] relative",
                  locked
                    ? "text-muted-foreground/40"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <item.icon className={cn("h-5 w-5", isActive && !locked && "text-primary")} />
                  {locked && (
                    <Lock className="h-2.5 w-2.5 absolute -top-1 -right-1.5 text-muted-foreground/60" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive && !locked && "text-primary"
                )}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <UpgradeModal
        open={upgradeModal.open}
        onOpenChange={(open) => setUpgradeModal(prev => ({ ...prev, open }))}
        featureName={upgradeModal.feature}
        requiredPlan={upgradeModal.plan}
      />
    </>
  );
}
