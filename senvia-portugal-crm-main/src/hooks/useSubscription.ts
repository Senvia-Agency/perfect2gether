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
  if (!org) return false;
  if ((org as any).billing_exempt) return false;
  const trialEnd = (org as any).trial_ends_at;
  if (!trialEnd) return false;
  return new Date(trialEnd).getTime() > Date.now();
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
        .rpc('get_subscription_plan' as any, { _plan_id: planId });

      // Fallback: direct SQL via rest if rpc not available
      if (error || !data) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/subscription_plans?id=eq.${planId}&select=*`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          }
        );
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_PLAN;
        const row = rows[0];
        return {
          id: row.id,
          name: row.name,
          max_users: row.max_users,
          max_forms: row.max_forms,
          price_monthly: Number(row.price_monthly),
          features: row.features as PlanFeatures,
        } as SubscriptionPlan;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return DEFAULT_PLAN;

      return {
        id: row.id,
        name: row.name,
        max_users: row.max_users,
        max_forms: row.max_forms,
        price_monthly: Number(row.price_monthly),
        features: row.features as PlanFeatures,
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
