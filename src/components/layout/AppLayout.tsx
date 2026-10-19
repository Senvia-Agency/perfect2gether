import { LegacyAppLayout } from './LegacyAppLayout';
import { useReleaseFeatures } from '@/hooks/useReleaseFeatures';
import { ReactNode, useState } from "react";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileMenu } from "./MobileMenu";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
  userName?: string;
  organizationName?: string;
}

export function AppLayout({ children, userName, organizationName }: AppLayoutProps) {
  const { features } = useReleaseFeatures();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!features.new_ui) return <LegacyAppLayout userName={userName} organizationName={organizationName}>{children}</LegacyAppLayout>;
  // Mobile layout
  if (isMobile) {
    return (
      <div className="p2g-shell min-h-screen bg-background">
        <MobileHeader
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMenuOpen={isMobileMenuOpen}
          organizationName={organizationName}
        />
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          userName={userName}
          organizationName={organizationName}
        />
        <main style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
          <div className="min-h-[calc(100dvh-8.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>
        <MobileBottomNav onMenuOpen={() => setIsMobileMenuOpen(true)} />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar userName={userName} organizationName={organizationName} />
      <main className="pl-64">
        <AppHeader />
        <div className="min-h-[calc(100dvh-3.5rem)]">
          {children}
        </div>
      </main>
    </div>
  );
}
