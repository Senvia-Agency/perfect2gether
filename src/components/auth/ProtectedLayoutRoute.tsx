import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AccountLoading } from './AccountLoading';
import { OrganizationSelector } from './OrganizationSelector';
import { useMfaCheckpoint } from './MfaCheckpoint';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { usePermissions } from '@/hooks/usePermissions';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { AppLayout } from '@/components/layout/AppLayout';
import { WhatsNewDialog } from '@/components/announcements/WhatsNewDialog';
import { AccountLoadError } from './AccountLoadError';

export function ProtectedLayoutRoute() {
  const { user, isLoading, userDataError, retryUserData, needsOrgSelection, organizations, selectOrganization, organization, profile } = useAuth();
  const location = useLocation();
  const mfaCheckpoint = useMfaCheckpoint();
  const { data: pipelineStages, isLoading: stagesLoading } = usePipelineStages();
  const { isAdmin, isLoadingPermissions, hasSystem } = usePermissions();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (isLoading) {
    return <AccountLoading />;
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (mfaCheckpoint) return mfaCheckpoint;

  if (userDataError) {
    return <AccountLoadError retry={retryUserData} failed />;
  }

  if (needsOrgSelection && organizations.length > 1) {
    return (
      <OrganizationSelector 
        organizations={organizations}
        onSelect={selectOrganization}
      />
    );
  }

  if (!organization) {
    return <AccountLoadError retry={retryUserData} failed={false} />;
  }

  // Keep the private shell behind the profile-permissions loading gate.
  if (isLoadingPermissions) {
    return <AccountLoading />;
  }

  if (!hasSystem('p2g')) {
    return hasSystem('total_link')
      ? <Navigate to="/portal-total-link/home" replace />
      : <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Esta conta não tem acesso ao Perfect2Gether.</div>;
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
      <PushSubscriptionRefresh />
      <Outlet />
      <WhatsNewDialog organizationId={organization?.id} />
    </AppLayout>
  );
}

function PushSubscriptionRefresh() {
  usePushNotifications();
  return null;
}
