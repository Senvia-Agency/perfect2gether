import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavItems, NavItem } from "@/hooks/useNavItems";
import { UpgradeModal } from "@/components/shared/UpgradeModal";

export function MobileBottomNav() {
  const location = useLocation();
  const { getRequiredPlan } = useSubscription();
  const { items } = useNavItems();

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
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-bottom overflow-hidden">
        <div className="flex items-center h-16 px-2 overflow-x-auto no-scrollbar gap-1">
          {items.map((item) => {
            const isActive = location.pathname === item.to ||
              (item.to !== "/dashboard" && location.pathname.startsWith(item.to));

            return (
              <NavLink
                key={item.to}
                to={item.locked ? "#" : item.to}
                onClick={(e) => handleLockedClick(e, item)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px] relative",
                  item.locked
                    ? "text-muted-foreground/40"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <item.icon className={cn("h-5 w-5", isActive && !item.locked && "text-primary")} />
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
