import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const SENVIA_AGENCY_ORG_ID = "06fe9e1d-9670-45b0-8717-c5a6e90be380";

const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U0wAc7Tuy8w6gA": "starter",
  "prod_U0wGoA4odOBHOZ": "pro",
  "prod_U0wG6doz0zgZFV": "elite",
};

const PLAN_LIST_NAMES: Record<string, string> = {
  starter: "Plano Starter",
  pro: "Plano Pro",
  elite: "Plano Elite",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    logStep("ERROR", { message: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });
    return new Response("Server config error", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    logStep("Signature verification failed", { error: (err as Error).message });
    return new Response("Invalid signature", { status: 400 });
  }

  logStep("Event received", { type: event.type, id: event.id });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const email = session.customer_email || session.customer_details?.email;
        if (!email) { logStep("No email in checkout session"); break; }
        const subId = session.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subId);
        const productId = sub.items.data[0].price.product as string;
        const plan = PRODUCT_TO_PLAN[productId];

        const orgId = await findOrgByEmail(supabase, email);
        let isReactivation = false;
        if (orgId) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("plan, payment_failed_at")
            .eq("id", orgId)
            .maybeSingle();
          isReactivation = !!(orgData?.plan || orgData?.payment_failed_at);
        }

        if (plan) await updateOrgPlan(supabase, email, plan);
        await clearPaymentFailed(supabase, email);

        const orgName = await getOrgNameByEmail(supabase, email);

        if (isReactivation) {
          await dispatchAutomation(supabase, "stripe_subscription_created", { email, plan: plan || "unknown", nome: orgName });
        }
        if (plan) {
          await dispatchAutomation(supabase, `stripe_welcome_${plan}`, { email, plan, nome: orgName });
        }

        await syncStripeAutoLists(supabase, email, orgName, "checkout_completed", plan || null, isReactivation);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const productId = sub.items.data[0].price.product as string;
        const plan = PRODUCT_TO_PLAN[productId];
        const customerId = sub.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer).email;

        if (plan && email) await updateOrgPlan(supabase, email, plan);

        if (email) {
          const orgName = await getOrgNameByEmail(supabase, email);

          if (sub.status === "past_due") {
            await recordPaymentFailed(supabase, email);
            await dispatchAutomation(supabase, "stripe_subscription_past_due", { email, plan: plan || "unknown", nome: orgName });
            await syncStripeAutoLists(supabase, email, orgName, "past_due", plan || null);
          }
          if (sub.status === "active") {
            await clearPaymentFailed(supabase, email);
            await dispatchAutomation(supabase, "stripe_subscription_renewed", { email, plan: plan || "unknown", nome: orgName });
            await syncStripeAutoLists(supabase, email, orgName, "renewed", plan || null);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const productId = sub.items.data[0].price.product as string;
        const plan = PRODUCT_TO_PLAN[productId];
        const customerId = sub.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer).email;
        if (email) {
          await updateOrgPlan(supabase, email, null);
          await clearPaymentFailed(supabase, email);
          const orgName = await getOrgNameByEmail(supabase, email);
          await dispatchAutomation(supabase, "stripe_subscription_canceled", { email, plan: plan || "unknown", nome: orgName });
          await syncStripeAutoLists(supabase, email, orgName, "canceled", plan || null);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const email = invoice.customer_email;
        logStep("Payment failed", { customer: invoice.customer, email });
        if (email) {
          await recordPaymentFailed(supabase, email);
          const orgName = await getOrgNameByEmail(supabase, email);
          await dispatchAutomation(supabase, "stripe_payment_failed", { email, plan: "unknown", nome: orgName });
          await syncStripeAutoLists(supabase, email, orgName, "payment_failed", null);
        }
        break;
      }
      case "invoice.paid": {
        await handleInvoicePaid(supabase, stripe, event.data.object as Stripe.Invoice);
        break;
      }
      default:
        logStep("Unhandled event type", { type: event.type });
    }
  } catch (err) {
    logStep("Processing error", { error: (err as Error).message });
    return new Response("Processing error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

// --- Invoice Paid → Recurring Commission ---

async function handleInvoicePaid(supabase: any, stripe: Stripe, invoice: Stripe.Invoice) {
  try {
    const email = invoice.customer_email;
    if (!email) { logStep("invoice.paid: no email"); return; }

    const amount = (invoice.amount_paid || 0) / 100; // cents to euros
    if (amount <= 0) { logStep("invoice.paid: zero amount"); return; }

    // Determine plan from subscription
    let plan: string | null = null;
    const subId = invoice.subscription as string | null;
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      const productId = sub.items.data[0]?.price?.product as string;
      plan = PRODUCT_TO_PLAN[productId] || null;
    }

    // Find the client organization by email
    const clientOrgId = await findOrgByEmail(supabase, email);
    if (!clientOrgId) { logStep("invoice.paid: no org found for email", { email }); return; }

    // Check for duplicate (same stripe invoice ID)
    const stripeInvoiceId = invoice.id;
    const { data: existing } = await supabase
      .from("stripe_commission_records")
      .select("id")
      .eq("stripe_invoice_id", stripeInvoiceId)
      .limit(1);
    
    if (existing && existing.length > 0) {
      logStep("invoice.paid: commission already recorded", { stripeInvoiceId });
      return;
    }

    // Find sale in Senvia org linked to this client org
    const { data: sales, error: salesErr } = await supabase
      .from("sales")
      .select("id, created_by, total_value, has_recurring")
      .eq("organization_id", SENVIA_AGENCY_ORG_ID)
      .eq("client_org_id", clientOrgId)
      .in("status", ["in_progress", "fulfilled", "delivered"])
      .limit(1);

    if (salesErr) { logStep("invoice.paid: sales query error", { error: salesErr.message }); return; }
    if (!sales || sales.length === 0) { logStep("invoice.paid: no linked sale found", { clientOrgId }); return; }

    const sale = sales[0];
    if (!sale.created_by) { logStep("invoice.paid: sale has no created_by"); return; }

    // Get commission rate for the salesperson
    const salesSettings = await getOrgSalesSettings(supabase);
    const globalRate = salesSettings?.commission_percentage || 0;

    const { data: member } = await supabase
      .from("organization_members")
      .select("commission_rate")
      .eq("organization_id", SENVIA_AGENCY_ORG_ID)
      .eq("user_id", sale.created_by)
      .eq("is_active", true)
      .maybeSingle();

    const rate = globalRate > 0 ? globalRate : Number(member?.commission_rate || 0);
    if (rate <= 0) { logStep("invoice.paid: no commission rate", { userId: sale.created_by }); return; }

    const commissionAmount = amount * (rate / 100);

    // Extract period
    const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000).toISOString().split("T")[0] : null;
    const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000).toISOString().split("T")[0] : null;

    // Insert commission record
    const { error: insertErr } = await supabase
      .from("stripe_commission_records")
      .insert({
        organization_id: SENVIA_AGENCY_ORG_ID,
        sale_id: sale.id,
        user_id: sale.created_by,
        client_org_id: clientOrgId,
        amount,
        commission_rate: rate,
        commission_amount: commissionAmount,
        stripe_invoice_id: stripeInvoiceId,
        period_start: periodStart,
        period_end: periodEnd,
        plan,
        status: "pending",
      });

    if (insertErr) {
      logStep("invoice.paid: insert error", { error: insertErr.message });
    } else {
      logStep("invoice.paid: commission recorded", { 
        userId: sale.created_by, amount, rate, commissionAmount, plan 
      });
    }

    // Update linked sale value to reflect actual Stripe payment
    const { error: saleUpdateErr } = await supabase
      .from("sales")
      .update({
        total_value: amount,
        recurring_value: amount,
        recurring_status: "active",
        next_renewal_date: periodEnd,
        ...(sale.status === "pending" ? { status: "in_progress" } : {}),
      })
      .eq("id", sale.id);

    if (saleUpdateErr) {
      logStep("invoice.paid: sale update error", { error: saleUpdateErr.message });
    } else {
      logStep("invoice.paid: sale value updated", { saleId: sale.id, amount, plan });
    }
  } catch (err) {
    logStep("invoice.paid: error", { error: (err as Error).message });
  }
}

async function getOrgSalesSettings(supabase: any) {
  const { data } = await supabase
    .from("organizations")
    .select("sales_settings")
    .eq("id", SENVIA_AGENCY_ORG_ID)
    .maybeSingle();
  return data?.sales_settings || {};
}

// --- Stripe Auto-Lists Sync ---

type ListEventType = "checkout_completed" | "renewed" | "past_due" | "payment_failed" | "canceled";

async function syncStripeAutoLists(
  supabase: any,
  email: string,
  name: string,
  eventType: ListEventType,
  plan: string | null,
  isReactivation: boolean = false
) {
  try {
    logStep("Syncing Stripe auto-lists", { email, eventType, plan });

    await supabase.rpc("ensure_stripe_auto_lists", { p_org_id: SENVIA_AGENCY_ORG_ID });

    const { data: contact, error: contactErr } = await supabase
      .from("marketing_contacts")
      .upsert(
        { organization_id: SENVIA_AGENCY_ORG_ID, email, name: name || email, source: "stripe", subscribed: true },
        { onConflict: "organization_id,email" }
      )
      .select("id")
      .single();

    if (contactErr || !contact) {
      logStep("Failed to upsert marketing contact", { error: contactErr?.message });
      return;
    }
    const contactId = contact.id;

    const { data: lists } = await supabase
      .from("client_lists")
      .select("id, name")
      .eq("organization_id", SENVIA_AGENCY_ORG_ID)
      .eq("is_system", true)
      .in("name", ["Plano Starter", "Plano Pro", "Plano Elite", "Pagamento em Atraso", "Subscrição Cancelada", "Clientes em Trial", "Trial Expirado", "Subscrição Reativada"]);

    if (!lists || lists.length === 0) {
      logStep("No Stripe auto-lists found");
      return;
    }

    const listMap: Record<string, string> = {};
    for (const l of lists) listMap[l.name] = l.id;

    const planListIds = [listMap["Plano Starter"], listMap["Plano Pro"], listMap["Plano Elite"]].filter(Boolean);
    const overdueListId = listMap["Pagamento em Atraso"];
    const canceledListId = listMap["Subscrição Cancelada"];
    const trialListId = listMap["Clientes em Trial"];
    const trialExpiredListId = listMap["Trial Expirado"];
    const reactivatedListId = listMap["Subscrição Reativada"];
    const currentPlanListId = plan ? listMap[PLAN_LIST_NAMES[plan]] : null;

    const addToList = async (listId: string) => {
      if (!listId) return;
      await supabase.from("marketing_list_members").upsert(
        { list_id: listId, contact_id: contactId },
        { onConflict: "list_id,contact_id" }
      );
    };

    const removeFromList = async (listId: string) => {
      if (!listId) return;
      await supabase.from("marketing_list_members")
        .delete()
        .eq("list_id", listId)
        .eq("contact_id", contactId);
    };

    const removeFromLists = async (listIds: string[]) => {
      for (const id of listIds) await removeFromList(id);
    };

    switch (eventType) {
      case "checkout_completed":
      case "renewed":
        if (currentPlanListId) await addToList(currentPlanListId);
        for (const id of planListIds) {
          if (id !== currentPlanListId) await removeFromList(id);
        }
        if (overdueListId) await removeFromList(overdueListId);
        if (canceledListId) await removeFromList(canceledListId);
        if (trialListId) await removeFromList(trialListId);
        if (trialExpiredListId) await removeFromList(trialExpiredListId);
        if (isReactivation && reactivatedListId) await addToList(reactivatedListId);
        break;

      case "past_due":
      case "payment_failed":
        if (overdueListId) await addToList(overdueListId);
        break;

      case "canceled":
        await removeFromLists(planListIds);
        if (overdueListId) await removeFromList(overdueListId);
        if (reactivatedListId) await removeFromList(reactivatedListId);
        if (canceledListId) await addToList(canceledListId);
        break;
    }

    logStep("Auto-lists synced successfully", { eventType, plan });
  } catch (err) {
    logStep("Auto-lists sync failed", { error: (err as Error).message });
  }
}

// --- Helper functions ---

async function dispatchAutomation(supabase: any, triggerType: string, record: Record<string, string>) {
  try {
    logStep("Dispatching automation", { triggerType, record });
    const { error } = await supabase.functions.invoke("process-automation", {
      body: {
        trigger_type: triggerType,
        organization_id: SENVIA_AGENCY_ORG_ID,
        record,
      },
    });
    if (error) logStep("Automation dispatch error", { error: error.message });
    else logStep("Automation dispatched", { triggerType });
  } catch (err) {
    logStep("Automation dispatch failed", { error: (err as Error).message });
  }
}

async function getOrgNameByEmail(supabase: any, email: string): Promise<string> {
  try {
    const orgId = await findOrgByEmail(supabase, email);
    if (!orgId) return "";
    const { data } = await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle();
    return data?.name || "";
  } catch {
    return "";
  }
}

async function findOrgByEmail(supabase: any, email: string) {
  const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { logStep("Error listing users", { error: listErr.message }); return null; }

  const user = users.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) { logStep("User not found", { email }); return null; }

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!member) { logStep("No org membership found", { userId: user.id }); return null; }
  return member.organization_id;
}

async function updateOrgPlan(supabase: any, email: string, plan: string | null) {
  logStep("Updating org plan", { email, plan });
  const orgId = await findOrgByEmail(supabase, email);
  if (!orgId) return;

  const { error: updateErr } = await supabase
    .from("organizations")
    .update({ plan: plan || null })
    .eq("id", orgId);

  if (updateErr) {
    logStep("Failed to update plan", { error: updateErr.message });
  } else {
    logStep("Plan updated successfully", { orgId, plan });
  }
}

async function recordPaymentFailed(supabase: any, email: string) {
  logStep("Recording payment failure", { email });
  const orgId = await findOrgByEmail(supabase, email);
  if (!orgId) return;

  const { error } = await supabase
    .from("organizations")
    .update({ payment_failed_at: new Date().toISOString() })
    .eq("id", orgId)
    .is("payment_failed_at", null);

  if (error) {
    logStep("Failed to record payment failure", { error: error.message });
  } else {
    logStep("Payment failure recorded", { orgId });
  }
}

async function clearPaymentFailed(supabase: any, email: string) {
  logStep("Clearing payment failure", { email });
  const orgId = await findOrgByEmail(supabase, email);
  if (!orgId) return;

  const { error } = await supabase
    .from("organizations")
    .update({ payment_failed_at: null })
    .eq("id", orgId);

  if (error) {
    logStep("Failed to clear payment failure", { error: error.message });
  } else {
    logStep("Payment failure cleared", { orgId });
  }
}
