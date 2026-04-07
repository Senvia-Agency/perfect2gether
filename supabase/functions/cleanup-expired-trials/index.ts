import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CLEANUP-EXPIRED-TRIALS] ${step}${d}`);
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
    logStep("Starting cleanup");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find organizations where trial ended more than 60 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    const { data: expiredOrgs, error: fetchError } = await supabaseClient
      .from('organizations')
      .select('id, name, trial_ends_at')
      .eq('billing_exempt', false)
      .not('trial_ends_at', 'is', null)
      .lt('trial_ends_at', cutoffDate.toISOString());

    if (fetchError) throw new Error(`Failed to fetch expired orgs: ${fetchError.message}`);
    if (!expiredOrgs || expiredOrgs.length === 0) {
      logStep("No expired organizations found");
      return new Response(JSON.stringify({ deleted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep(`Found ${expiredOrgs.length} potentially expired orgs`);

    let deletedCount = 0;

    for (const org of expiredOrgs) {
      // Check if org has active Stripe subscription via members' emails
      const { data: members } = await supabaseClient
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .limit(1);

      if (members && members.length > 0) {
        const { data: userData } = await supabaseClient.auth.admin.getUserById(members[0].user_id);
        if (userData?.user?.email) {
          const customers = await stripe.customers.list({ email: userData.user.email, limit: 1 });
          if (customers.data.length > 0) {
            const subs = await stripe.subscriptions.list({
              customer: customers.data[0].id,
              status: "active",
              limit: 1,
            });
            if (subs.data.length > 0) {
              logStep(`Org ${org.id} has active subscription, skipping`);
              continue;
            }
          }
        }
      }

      logStep(`Deleting data for org: ${org.id} (${org.name})`);

      // Delete all org data in order (respecting foreign keys)
      const tables = [
        'proposal_cpes', 'proposal_products', 'sale_items', 'sale_payments',
        'bank_account_transactions', 'credit_notes', 'invoices',
        'client_communications', 'cpes', 'calendar_events',
        'email_sends', 'email_campaigns', 'email_templates',
        'dashboard_widgets', 'forms', 'expenses', 'expense_categories',
        'client_list_members', 'client_lists',
        'proposals', 'sales', 'crm_clients', 'leads',
        'internal_requests', 'bank_accounts',
        'organization_invites', 'organization_members',
      ];

      for (const table of tables) {
        const { error } = await supabaseClient
          .from(table)
          .delete()
          .eq('organization_id', org.id);
        if (error) {
          logStep(`Warning: failed to delete from ${table}`, { error: error.message });
        }
      }

      // Delete the organization itself
      const { error: deleteOrgError } = await supabaseClient
        .from('organizations')
        .delete()
        .eq('id', org.id);

      if (deleteOrgError) {
        logStep(`Failed to delete org ${org.id}`, { error: deleteOrgError.message });
      } else {
        deletedCount++;
        logStep(`Successfully deleted org: ${org.id}`);
      }
    }

    logStep(`Cleanup complete. Deleted ${deletedCount} organizations.`);

    return new Response(JSON.stringify({ deleted: deletedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
