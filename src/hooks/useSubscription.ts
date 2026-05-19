import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type ModuleKey = 'sales' | 'finance' | 'marketing' | 'ecommerce';
type IntegrationKey = 'whatsapp' | 'invoicing' | 'meta_pixels' | 'stripe';
type FeatureKey = 'conversational_forms' | 'multi_org' | 'push_notifications' | 'fidelization_alerts';

interface PlanFeatures {
  modules: Record<ModuleKey, boolean>;
  integrations: Record<IntegrationKey, boolean>;
  features: Record<FeatureKey, boolean>;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  max_users: number | null;
  max_forms: number | null;
  features: PlanFeatures;
  price_monthly: number;
}

const DEFAULT_PLAN: SubscriptionPlan = {
  id: 'starter',
  name: 'Starter',
  max_users: 10,
  max_forms: 2,
  price_monthly: 49,
  features: {
    modules: { sales: false, finance: false, marketing: false, ecommerce: false },
    integrations: { whatsapp: false, invoicing: false, meta_pixels: false, stripe: false },
    features: { conversational_forms: false, multi_org: false, push_notifications: false, fidelization_alerts: false },
  },
};

// Map module keys to minimum required plan for upsell messaging
const MODULE_REQUIRED_PLAN: Record<string, string> = {
  sales: 'Pro',
  finance: 'Elite',
  marketing: 'Pro',
  ecommerce: 'Elite',
  prospects: 'Elite',
};

function isOrgOnTrial(org: { trial_ends_at?: string; billing_exempt?: boolean } | null): boolean {
  return false;
}

export function useSubscription() {
  const { organization } = useAuth();
  
  // If on trial, use 'elite' features; otherwise use the DB plan
  const onTrial = isOrgOnTrial(organization as any);
  const planId = onTrial ? 'elite' : (organization?.plan || 'starter');

  const { data: plan, isLoading } = useQuery({
    queryKey: ['subscription-plan', planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

      if (error || !data) return DEFAULT_PLAN;

      return {
        id: data.id,
        name: data.name,
        max_users: data.max_users,
        max_forms: data.max_forms,
        price_monthly: Number(data.price_monthly),
        features: data.features as PlanFeatures,
      } as SubscriptionPlan;
    },
    enabled: !!organization,
    staleTime: 1000 * 60 * 10,
  });

  const currentPlan = plan || DEFAULT_PLAN;

  const canUseModule = (module: ModuleKey): boolean => {
    return currentPlan.features?.modules?.[module] ?? false;
  };

  const canUseIntegration = (integration: IntegrationKey): boolean => {
    return currentPlan.features?.integrations?.[integration] ?? false;
  };

  const canUseFeature = (feature: FeatureKey): boolean => {
    return currentPlan.features?.features?.[feature] ?? false;
  };

  const isModuleLocked = (moduleKey: string): boolean => {
    const modulesMap = currentPlan.features?.modules;
    if (!modulesMap) return false;
    return moduleKey in modulesMap && !modulesMap[moduleKey as ModuleKey];
  };

  const getRequiredPlan = (moduleKey: string): string => {
    return MODULE_REQUIRED_PLAN[moduleKey] || 'Pro';
  };

  return {
    plan: currentPlan.id,
    planName: currentPlan.name,
    onTrial,
    limits: {
      maxUsers: currentPlan.max_users,
      maxForms: currentPlan.max_forms,
    },
    isLoading,
    canUseModule,
    canUseIntegration,
    canUseFeature,
    isModuleLocked,
    getRequiredPlan,
  };
}
