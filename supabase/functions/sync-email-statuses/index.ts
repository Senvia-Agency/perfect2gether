import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function syncOrganization(supabase: any, orgId: string, brevoApiKey: string) {
  const { data: pendingEmails, error: fetchError } = await supabase
    .from("email_sends")
    .select("id, brevo_message_id, status")
    .eq("organization_id", orgId)
    .eq("status", "sent")
    .not("brevo_message_id", "is", null);

  if (fetchError) {
    console.error(`Error fetching pending emails for org ${orgId}:`, fetchError);
    return { updated: 0, errors: 1 };
  }

  if (!pendingEmails || pendingEmails.length === 0) {
    return { updated: 0, errors: 0 };
  }

  console.log(`Syncing ${pendingEmails.length} emails for org ${orgId}`);

  let updated = 0;
  let errors = 0;

  for (const email of pendingEmails) {
    try {
      const brevoRes = await fetch(
        `https://api.brevo.com/v3/smtp/statistics/events?messageId=${email.brevo_message_id}&limit=50`,
        {
          headers: {
            "api-key": brevoApiKey,
            "Accept": "application/json",
          },
        }
      );

      if (!brevoRes.ok) {
        console.error(`Brevo API error for message ${email.brevo_message_id}: ${brevoRes.status}`);
        errors++;
        continue;
      }

      const brevoData = await brevoRes.json();
      const events = brevoData.events || [];

      if (events.length === 0) continue;

      const updateData: Record<string, any> = {};

      for (const evt of events) {
        const eventName = evt.event;
        switch (eventName) {
          case "delivered":
            updateData.status = "delivered";
            break;
          case "opened":
          case "unique_opened":
            updateData.opened_at = evt.date || new Date().toISOString();
            break;
          case "click":
            updateData.clicked_at = evt.date || new Date().toISOString();
            break;
          case "hardBounce":
          case "softBounce":
          case "hard_bounce":
          case "soft_bounce":
            updateData.status = "bounced";
            updateData.error_message = `${eventName}: ${evt.reason || ""}`;
            break;
          case "blocked":
            updateData.status = "blocked";
            updateData.error_message = evt.reason || "Blocked";
            break;
          case "spam":
            updateData.status = "spam";
            break;
          case "unsubscribed":
            updateData.status = "unsubscribed";
            break;
        }
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("email_sends")
          .update(updateData)
          .eq("id", email.id);

        if (updateError) {
          console.error(`Error updating email ${email.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error processing email ${email.id}:`, err);
      errors++;
    }
  }

  return { updated, errors };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let organizationId: string | null = null;

    // Try to parse body (cron calls may send empty or minimal body)
    try {
      const body = await req.json();
      organizationId = body?.organizationId || null;
    } catch {
      // No body = sync_all mode (cron job)
    }

    if (organizationId) {
      // Single org mode
      const { data: org } = await supabase
        .from("organizations")
        .select("brevo_api_key")
        .eq("id", organizationId)
        .single();

      if (!org?.brevo_api_key) {
        return new Response(JSON.stringify({ error: "Brevo API key not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await syncOrganization(supabase, organizationId, org.brevo_api_key);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync ALL orgs with brevo_api_key
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, brevo_api_key")
      .not("brevo_api_key", "is", null)
      .neq("brevo_api_key", "");

    if (orgsError) {
      console.error("Error fetching organizations:", orgsError);
      return new Response(JSON.stringify({ error: "Failed to fetch organizations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ message: "No organizations with Brevo configured", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sync all mode: ${orgs.length} organizations with Brevo configured`);

    let totalUpdated = 0;
    let totalErrors = 0;

    for (const org of orgs) {
      const result = await syncOrganization(supabase, org.id, org.brevo_api_key);
      totalUpdated += result.updated;
      totalErrors += result.errors;
    }

    console.log(`Global sync complete: ${totalUpdated} updated, ${totalErrors} errors across ${orgs.length} orgs`);

    return new Response(
      JSON.stringify({ updated: totalUpdated, errors: totalErrors, organizations: orgs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
