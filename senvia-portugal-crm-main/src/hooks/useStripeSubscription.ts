import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionStatus {
  subscribed: boolean;
  plan_id: string | null;
  product_id: string | null;
  subscription_end: string | null;
  billing_exempt?: boolean;
  on_trial?: boolean;
  trial_ends_at?: string;
  trial_expired?: boolean;
  days_remaining?: number;
  payment_failed_at?: string;
  payment_overdue?: boolean;
}

export function useStripeSubscription() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscriptionStatus(data);
      return data as SubscriptionStatus;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return null;
    }
  }, []);

  const createCheckout = useCallback(async (priceId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar o checkout. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const openCustomerPortal = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível abrir o portal de faturação.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    isLoading,
    subscriptionStatus,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
}
