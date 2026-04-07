import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) throw new Error("Access denied: super_admin only");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch ALL active + trialing subscriptions from Stripe
    const allSubs: Stripe.Subscription[] = [];
    for (const status of ["active", "trialing"] as const) {
      let hasMore = true;
      let startingAfter: string | undefined;
      while (hasMore) {
        const params: Stripe.SubscriptionListParams = { status, limit: 100 };
        if (startingAfter) params.starting_after = startingAfter;
        const batch = await stripe.subscriptions.list(params);
        allSubs.push(...batch.data);
        hasMore = batch.has_more;
        if (batch.data.length > 0) {
          startingAfter = batch.data[batch.data.length - 1].id;
        }
      }
    }

    // Get all orgs with their emails via organization_members -> profiles
    const { data: orgs } = await supabaseClient
      .from("organizations")
      .select("id, name, slug, billing_exempt, trial_ends_at");

    const { data: members } = await supabaseClient
      .from("organization_members")
      .select("organization_id, user_id")
      .eq("is_active", true);

    // Get user emails
    const userIds = [...new Set((members || []).map(m => m.user_id))];
    const emailMap: Record<string, string> = {};
    
    // Batch fetch emails from auth
    for (const uid of userIds) {
      const { data } = await supabaseClient.auth.admin.getUserById(uid);
      if (data?.user?.email) {
        emailMap[uid] = data.user.email.toLowerCase();
      }
    }

    // Map org -> emails
    const orgEmails: Record<string, string[]> = {};
    for (const m of (members || [])) {
      const email = emailMap[m.user_id];
      if (email) {
        if (!orgEmails[m.organization_id]) orgEmails[m.organization_id] = [];
        orgEmails[m.organization_id].push(email);
      }
    }

    // Map Stripe customer emails -> subscriptions
    const emailToSub: Record<string, {
      plan: string;
      amount: number;
      status: string;
      current_period_end: string;
      stripe_customer_id: string;
    }> = {};

    for (const sub of allSubs) {
      const customer = sub.customer as string;
      // Get customer email
      const cust = await stripe.customers.retrieve(customer);
      if ((cust as any).deleted) continue;
      const email = ((cust as Stripe.Customer).email || "").toLowerCase();
      if (!email) continue;

      const item = sub.items.data[0];
      const productId = item.price.product as string;
      const planId = PRODUCT_TO_PLAN[productId] || "unknown";
      const amount = (item.price.unit_amount || 0) / 100;

      emailToSub[email] = {
        plan: planId,
        amount,
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        stripe_customer_id: customer,
      };
    }

    // Build per-org stats
    const orgStats: {
      org_id: string;
      stripe_plan: string | null;
      stripe_amount: number;
      stripe_status: string | null;
      stripe_period_end: string | null;
      has_stripe_subscription: boolean;
    }[] = [];

    let totalMRR = 0;
    let payingCount = 0;

    for (const org of (orgs || [])) {
      const emails = orgEmails[org.id] || [];
      let found = false;

      for (const email of emails) {
        const sub = emailToSub[email];
        if (sub) {
          orgStats.push({
            org_id: org.id,
            stripe_plan: sub.plan,
            stripe_amount: sub.amount,
            stripe_status: sub.status,
            stripe_period_end: sub.current_period_end,
            has_stripe_subscription: true,
          });
          if (sub.status === "active") {
            totalMRR += sub.amount;
            payingCount++;
          }
          found = true;
          break;
        }
      }

      if (!found) {
        orgStats.push({
          org_id: org.id,
          stripe_plan: null,
          stripe_amount: 0,
          stripe_status: null,
          stripe_period_end: null,
          has_stripe_subscription: false,
        });
      }
    }

    return new Response(JSON.stringify({
      mrr: totalMRR,
      paying_count: payingCount,
      total_subscriptions: allSubs.length,
      org_stats: orgStats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ADMIN-STRIPE-STATS] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
