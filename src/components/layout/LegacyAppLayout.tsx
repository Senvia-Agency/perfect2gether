import { ReactNode, useState } from "react";
import { LegacyAppSidebar } from "./LegacyAppSidebar";
import { LegacyMobileHeader } from "./LegacyMobileHeader";
import { LegacyMobileBottomNav } from "./LegacyMobileBottomNav";
import { LegacyMobileMenu } from "./LegacyMobileMenu";
import { useIsMobile } from "@/hooks/use-mobile";

interface LegacyAppLayoutProps {
  children: ReactNode;
  userName?: string;
  organizationName?: string;
}

export function LegacyAppLayout({ children, userName, organizationName }: LegacyAppLayoutProps) {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <LegacyMobileHeader
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMenuOpen={isMobileMenuOpen}
          organizationName={organizationName}
        />
        <LegacyMobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          userName={userName}
          organizationName={organizationName}
        />
        <main className="pb-20" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}>
          <div className="min-h-[calc(100vh-8.5rem)]">
            {children}
          </div>
        </main>
        <LegacyMobileBottomNav />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen bg-background">
      <LegacyAppSidebar userName={userName} organizationName={organizationName} />
      <main className="pl-64">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
