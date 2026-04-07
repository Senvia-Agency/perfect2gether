import { ReactNode, useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileMenu } from "./MobileMenu";
import { TrialBanner } from "./TrialBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";
import { OttoFAB } from "@/components/otto/OttoFAB";

interface AppLayoutProps {
  children: ReactNode;
  userName?: string;
  organizationName?: string;
}

export function AppLayout({ children, userName, organizationName }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { subscriptionStatus, checkSubscription } = useStripeSubscription();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!hasChecked) {
      checkSubscription().then(() => setHasChecked(true));
    }
  }, [hasChecked, checkSubscription]);

  const showTrialBanner = hasChecked && subscriptionStatus?.on_trial && !subscriptionStatus?.billing_exempt && (subscriptionStatus?.days_remaining ?? 0) > 0;

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader 
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMenuOpen={isMobileMenuOpen}
          organizationName={organizationName}
        />
        {showTrialBanner && <div style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}><TrialBanner daysRemaining={subscriptionStatus!.days_remaining!} totalDays={14} /></div>}
        <MobileMenu 
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          userName={userName}
          organizationName={organizationName}
        />
        <main className="pb-20" style={{ paddingTop: showTrialBanner ? undefined : 'calc(3.5rem + env(safe-area-inset-top))' }}>
          <div className="min-h-[calc(100vh-8.5rem)]">
            {children}
          </div>
        </main>
        <MobileBottomNav />
        <OttoFAB />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar userName={userName} organizationName={organizationName} />
      <main className="pl-64">
        {showTrialBanner && <TrialBanner daysRemaining={subscriptionStatus!.days_remaining!} />}
        <div className="min-h-screen">
          {children}
        </div>
      </main>
      <OttoFAB />
    </div>
  );
}
