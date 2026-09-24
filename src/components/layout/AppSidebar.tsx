import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowRightLeft, LogOut, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavItems, NavItem } from "@/hooks/useNavItems";
import { APP_VERSION } from "@/lib/constants";
import { getRoleLabel } from "@/lib/roles";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import { UpgradeModal } from "@/components/shared/UpgradeModal";
import { isPerfect2GetherOrg } from "@/lib/perfect2gether";

interface AppSidebarProps {
  userName?: string;
  organizationName?: string;
}

export function AppSidebar({
  userName = "Utilizador",
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, roles, organization } = useAuth();
  const { profileName, hasSystem } = usePermissions();
  const { getRequiredPlan } = useSubscription();
  const { items } = useNavItems();

  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; feature: string; plan: string }>({
    open: false, feature: '', plan: ''
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleLockedClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.locked && item.moduleKey) {
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
              src="/logo-p2gether.png"
            />
          </div>

          <div className="border-b border-sidebar-border px-3 py-3">
            <OrganizationSwitcher />
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {items.map(item => {
              const isActive = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));

              return (
                <NavLink
                  key={item.to}
                  to={item.locked ? "#" : item.to}
                  onClick={(e) => handleLockedClick(e, item)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    item.locked
                      ? "cursor-pointer text-sidebar-muted/50 hover:bg-sidebar-accent/30"
                      : isActive
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.locked && <Lock className="h-3.5 w-3.5 text-sidebar-muted/60" />}
                </NavLink>
              );
            })}
            {isPerfect2GetherOrg(organization?.id) && hasSystem('total_link') && (
              <NavLink
                to="/portal-total-link/home"
                className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border-t border-sidebar-border px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground"
              >
                <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
                <span>Ir para Total Link</span>
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
                <p className="text-xs text-sidebar-muted">{getRoleLabel({ roles, profileName })}</p>
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
