import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { OrganizationSelector } from './OrganizationSelector';
import { ChallengeMFA } from './ChallengeMFA';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { usePermissions } from '@/hooks/usePermissions';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { AppLayout } from '@/components/layout/AppLayout';
import { WhatsNewDialog } from '@/components/announcements/WhatsNewDialog';

export function ProtectedLayoutRoute() {
  const { user, isLoading, needsOrgSelection, organizations, selectOrganization, mfaStatus, completeMfaChallenge, organization, profile } = useAuth();
  const location = useLocation();
  const { data: pipelineStages, isLoading: stagesLoading } = usePipelineStages();
  const { isAdmin, isLoadingPermissions } = usePermissions();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Keep the entire private shell behind the same loading gate while the
  // organization profile permissions are being fetched. This prevents the
  // sidebar from flashing menus that the user cannot access.
  if (isLoadingPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (mfaStatus === 'pending') {
    return <ChallengeMFA onSuccess={completeMfaChallenge} />;
  }

  if (needsOrgSelection && organizations.length > 1) {
    return (
      <OrganizationSelector 
        organizations={organizations}
        onSelect={selectOrganization}
      />
    );
  }

  if (
    !onboardingComplete &&
    !stagesLoading &&
    organization?.id &&
    isAdmin &&
    pipelineStages &&
    pipelineStages.length === 0
  ) {
    return <OnboardingWizard onComplete={() => setOnboardingComplete(true)} />;
  }

  return (
    <AppLayout userName={profile?.full_name} organizationName={organization?.name}>
      <Outlet />
      <WhatsNewDialog organizationId={organization?.id} />
    </AppLayout>
  );
}
