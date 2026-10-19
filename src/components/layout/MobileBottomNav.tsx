import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Lock, Menu } from "lucide-react";
import { NavigationIcon } from './NavigationIcon';
import './navigation.css';
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavItems, NavItem } from "@/hooks/useNavItems";
import { UpgradeModal } from "@/components/shared/UpgradeModal";

export function MobileBottomNav({ onMenuOpen }: { readonly onMenuOpen: () => void }) {
  const location = useLocation();
  const { getRequiredPlan } = useSubscription();
  const { mobileShortcuts: shortcuts } = useNavItems();

  const isShortcutActive = shortcuts.some(item => location.pathname === item.to || location.pathname.startsWith(item.to + "/"));
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; feature: string; plan: string }>({
    open: false, feature: '', plan: ''
  });

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
      <nav aria-label="Navegação principal" className="fixed bottom-0 left-0 right-0 z-50 p2g-navigation border-t shadow-[0_-4px_24px_-18px_rgba(67,40,119,0.2)] safe-bottom overflow-hidden">
        <div className="grid h-16 items-center gap-1 px-2" style={{ gridTemplateColumns: `repeat(${shortcuts.length + 1},minmax(0,1fr))` }}>
          {shortcuts.map((item) => {
            const isActive = location.pathname === item.to ||
              (item.to !== "/dashboard" && location.pathname.startsWith(item.to));

            return (
              <NavLink
                key={item.to}
                  data-locked={item.locked ? 'true' : undefined}
                to={item.locked ? "#" : item.to}
                onClick={(e) => handleLockedClick(e, item)}
                className={cn(
                  "p2g-nav-link flex flex-col items-center justify-center gap-1 min-w-0 px-1 py-1.5 rounded-2xl relative",
                  item.locked
                    ? "text-muted-foreground/40"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  {!!item.unread && <span className="p2g-nav-badge absolute -right-2 -top-1 z-10 rounded-full bg-primary px-1 text-[10px] text-primary-foreground" aria-label={`${item.unread} mensagens não lidas`}>{item.unread}</span>}
                  <NavigationIcon icon={item.icon} route={item.to} small locked={item.locked} />
                  {item.locked && (
                    <Lock className="h-2.5 w-2.5 absolute -top-1 -right-1.5 text-muted-foreground/60" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  isActive && !item.locked && "text-primary"
                )}>
                  {item.shortLabel ?? item.label}
                </span>
              </NavLink>
            );
          })}
          <button type="button" onClick={onMenuOpen} aria-label="Mais opções de navegação" aria-haspopup="dialog" data-active={!isShortcutActive} className="p2g-nav-link flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-medium">
            <NavigationIcon icon={Menu} route="/settings" small /><span>Mais</span>
          </button>
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
