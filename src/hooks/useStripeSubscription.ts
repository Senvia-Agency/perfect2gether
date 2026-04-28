import { useCallback } from 'react';

interface SubscriptionStatus {
  subscribed: boolean;
  plan_id: string | null;
  product_id: string | null;
  subscription_end: string | null;
  billing_exempt: boolean;
  on_trial: boolean;
  trial_expired: boolean;
  payment_overdue: boolean;
}

const ALWAYS_ACTIVE: SubscriptionStatus = {
  subscribed: true,
  plan_id: null,
  product_id: null,
  subscription_end: null,
  billing_exempt: true,
  on_trial: false,
  trial_expired: false,
  payment_overdue: false,
};

export function useStripeSubscription() {
  const checkSubscription = useCallback(async () => ALWAYS_ACTIVE, []);
  const createCheckout = useCallback(async (_priceId: string) => {}, []);
  const openCustomerPortal = useCallback(async () => {}, []);

  return {
    isLoading: false,
    subscriptionStatus: ALWAYS_ACTIVE,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
}
