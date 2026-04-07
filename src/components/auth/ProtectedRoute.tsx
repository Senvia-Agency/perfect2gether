import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { OrganizationSelector } from './OrganizationSelector';
import { ChallengeMFA } from './ChallengeMFA';
import { TrialExpiredBlocker } from './TrialExpiredBlocker';
import { PaymentOverdueBlocker } from './PaymentOverdueBlocker';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { usePermissions } from '@/hooks/usePermissions';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, needsOrgSelection, organizations, selectOrganization, mfaStatus, completeMfaChallenge, organization } = useAuth();
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

  // MFA challenge required
  if (mfaStatus === 'pending') {
    return <ChallengeMFA onSuccess={completeMfaChallenge} />;
  }

  // Show organization selector if user needs to choose
  if (needsOrgSelection && organizations.length > 1) {
    return (
      <OrganizationSelector 
        organizations={organizations}
        onSelect={selectOrganization}
      />
    );
  }

  // Onboarding wizard: show if admin, org exists, no pipeline stages, not already completed
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

  // Check payment overdue - block all pages except /settings
  if (
    hasCheckedSub &&
    subscriptionStatus?.payment_overdue === true &&
    !location.pathname.startsWith('/settings')
  ) {
    return <PaymentOverdueBlocker paymentFailedAt={subscriptionStatus.payment_failed_at} />;
  }

  // Check trial expired - block all pages except /settings
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

  return <>{children}</>;
}
