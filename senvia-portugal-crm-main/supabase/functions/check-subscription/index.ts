import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U0wAc7Tuy8w6gA": "starter",
  "prod_U0wGoA4odOBHOZ": "pro",
  "prod_U0wG6doz0zgZFV": "elite",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { email: user.email });

    // Get user's organization
    const { data: memberData } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const orgId = memberData?.organization_id;

    // Get org data including trial_ends_at and billing_exempt
    let orgData: any = null;
    if (orgId) {
      const { data } = await supabaseClient
        .from('organizations')
        .select('billing_exempt, trial_ends_at, payment_failed_at')
        .eq('id', orgId)
        .maybeSingle();
      orgData = data;
    }

    // Check billing exemption
    if (orgData?.billing_exempt === true) {
      logStep("Organization is billing exempt, returning elite", { orgId });
      await supabaseClient
        .from('organizations')
        .update({ plan: 'elite' })
        .eq('id', orgId);

      return new Response(JSON.stringify({
        subscribed: true,
        plan_id: 'elite',
        product_id: null,
        subscription_end: null,
        billing_exempt: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
    logStep("No Stripe customer found, checking trial");
      const trialResp = buildTrialResponse(orgData);
      return new Response(JSON.stringify(trialResp), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Customer found", { customerId });

    // Check active subscriptions
    let subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    // Also check trialing subscriptions
    if (subscriptions.data.length === 0) {
      subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
    }

    if (subscriptions.data.length === 0) {
    logStep("No active/trialing subscription, checking trial");
      const trialResp2 = buildTrialResponse(orgData);
      return new Response(JSON.stringify(trialResp2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const productId = subscription.items.data[0].price.product as string;
    const planId = PRODUCT_TO_PLAN[productId] || "starter";
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

    logStep("Active subscription found", { productId, planId, subscriptionEnd });

    // Sync plan to organization
    if (orgId) {
      const { error: updateError } = await supabaseClient
        .from('organizations')
        .update({ plan: planId })
        .eq('id', orgId);

      if (updateError) {
        logStep("Failed to update org plan", { error: updateError.message });
      } else {
        logStep("Org plan synced", { orgId, plan: planId });
      }
    }

    const paymentOverdueData = getPaymentOverdueInfo(orgData);

    return new Response(JSON.stringify({
      subscribed: true,
      plan_id: planId,
      product_id: productId,
      subscription_end: subscriptionEnd,
      ...paymentOverdueData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function getPaymentOverdueInfo(orgData: any) {
  if (!orgData?.payment_failed_at) {
    return { payment_failed_at: null, payment_overdue: false };
  }
  const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
  const failedAt = new Date(orgData.payment_failed_at);
  const overdue = (Date.now() - failedAt.getTime()) > gracePeriodMs;
  return {
    payment_failed_at: orgData.payment_failed_at,
    payment_overdue: overdue,
  };
}

function buildTrialResponse(orgData: any) {
  const paymentOverdueData = getPaymentOverdueInfo(orgData);

  if (!orgData?.trial_ends_at) {
    return { subscribed: false, plan_id: null, subscription_end: null, on_trial: false, trial_expired: true, ...paymentOverdueData };
  }

  const trialEnd = new Date(orgData.trial_ends_at);
  const now = new Date();
  const diffMs = trialEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  if (diffMs > 0) {
    return {
      subscribed: false,
      plan_id: null,
      subscription_end: null,
      on_trial: true,
      trial_ends_at: orgData.trial_ends_at,
      days_remaining: daysRemaining,
      trial_expired: false,
      ...paymentOverdueData,
    };
  } else {
    return {
      subscribed: false,
      plan_id: null,
      subscription_end: null,
      on_trial: false,
      trial_ends_at: orgData.trial_ends_at,
      days_remaining: 0,
      trial_expired: true,
      ...paymentOverdueData,
    };
  }
}
