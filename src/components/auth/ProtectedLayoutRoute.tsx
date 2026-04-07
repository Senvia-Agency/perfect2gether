import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { OrganizationSelector } from './OrganizationSelector';
import { ChallengeMFA } from './ChallengeMFA';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { usePermissions } from '@/hooks/usePermissions';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { AppLayout } from '@/components/layout/AppLayout';
import { WhatsNewDialog } from '@/components/announcements/WhatsNewDialog';

export function ProtectedLayoutRoute() {
  const { user, isLoading, needsOrgSelection, organizations, selectOrganization, mfaStatus, completeMfaChallenge, organization, profile } = useAuth();
  const location = useLocation();
  const { subscriptionStatus, checkSubscription } = useStripeSubscription();
  const [hasCheckedSub, setHasCheckedSub] = useState(false);
  const { data: pipelineStages, isLoading: stagesLoading } = usePipelineStages();
  const { isAdmin } = usePermissions();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    if (user && !needsOrgSelection && !hasCheckedSub) {
      checkSubscription().then(() => setHasCheckedSub(true));
    }
  }, [user, needsOrgSelection, hasCheckedSub, checkSubscription]);

  if (isLoading) {
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

  if (
    hasCheckedSub &&
    subscriptionStatus &&
    !subscriptionStatus.subscribed &&
    !subscriptionStatus.billing_exempt &&
    subscriptionStatus.trial_expired === true &&
    !location.pathname.startsWith('/settings')
  ) {
    return <TrialExpiredBlocker trialEndsAt={subscriptionStatus.trial_ends_at} />;
  }

  return (
    <AppLayout userName={profile?.full_name} organizationName={organization?.name}>
      <Outlet />
      <WhatsNewDialog organizationId={organization?.id} />
    </AppLayout>
  );
}
