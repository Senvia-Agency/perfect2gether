import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BrevoEvent {
  email: string;
  date: string;
  messageId: string;
  event: string;
  subject?: string;
  tag?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { campaignId, organizationId } = await req.json();

    if (!campaignId || !organizationId) {
      return new Response(
        JSON.stringify({ error: "Missing campaignId or organizationId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("sent_at, subject, name, settings_data, status")
      .eq("id", campaignId)
      .eq("organization_id", organizationId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip sync for draft/scheduled campaigns
    if (campaign.status === 'draft' || campaign.status === 'scheduled') {
      // Still recalculate from email_sends for accuracy
      const metrics = await recalculateMetricsFromSends(supabase, campaignId);
      if (metrics.total > 0) {
        await supabase
          .from("email_campaigns")
          .update({
            total_recipients: metrics.total,
            sent_count: metrics.sent,
            failed_count: metrics.failed,
          })
          .eq("id", campaignId);
      }
      return new Response(
        JSON.stringify({ success: true, inserted: 0, updated: 0, errors: 0, skipped: true, ...metrics }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org brevo key
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("brevo_api_key")
      .eq("id", organizationId)
      .single();

    if (orgError || !org?.brevo_api_key) {
      // No Brevo key — still recalculate from existing email_sends
      const metrics = await recalculateMetricsFromSends(supabase, campaignId);
      if (metrics.total > 0) {
        await supabase
          .from("email_campaigns")
          .update({
            total_recipients: metrics.total,
            sent_count: metrics.sent,
            failed_count: metrics.failed,
          })
          .eq("id", campaignId);
      }
      return new Response(
        JSON.stringify({ success: true, inserted: 0, updated: 0, errors: 0, noBrevoKey: true, ...metrics }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine date range
    const startDate = campaign.sent_at
      ? new Date(new Date(campaign.sent_at).getTime() - 60 * 60 * 1000).toISOString().split("T")[0]
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const endDate = new Date().toISOString().split("T")[0];

    // Get campaign tag if set
    const settingsData = campaign.settings_data as Record<string, string> | null;
    const campaignTag = settingsData?.tag || null;

    // Fetch all events from Brevo API with pagination
    const allEvents: BrevoEvent[] = [];
    let offset = 0;
    const limit = 500;

    while (true) {
      const params = new URLSearchParams({
        startDate,
        endDate,
        limit: String(limit),
        offset: String(offset),
        sort: "asc",
      });
      if (campaignTag) params.set("tags", campaignTag);

      const url = `https://api.brevo.com/v3/smtp/statistics/events?${params}`;
      console.log(`Fetching Brevo events: offset=${offset}`);

      const response = await fetch(url, {
        headers: {
          "api-key": org.brevo_api_key,
          "accept": "application/json",
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Brevo API error:", response.status, errText);
        break;
      }

      const data = await response.json();
      const events: BrevoEvent[] = data.events || [];
      allEvents.push(...events);

      if (events.length < limit) break;
      offset += limit;
      if (offset > 10000) break;
    }

    console.log(`Total Brevo events fetched: ${allEvents.length}`);

    // Filter events that match this campaign's subject (if no tag)
    const campaignSubject = campaign.subject || campaign.name;
    const relevantEvents = campaignTag
      ? allEvents
      : allEvents.filter(e => e.subject && e.subject === campaignSubject);

    console.log(`Relevant events after filtering: ${relevantEvents.length}`);

    // Group events by email to build consolidated records
    const emailMap = new Map<string, {
      messageId: string;
      status: string;
      sentAt: string | null;
      openedAt: string | null;
      clickedAt: string | null;
      errorMessage: string | null;
    }>();

    for (const event of relevantEvents) {
      const existing = emailMap.get(event.email);
      if (!existing) {
        emailMap.set(event.email, {
          messageId: event.messageId,
          status: "sent",
          sentAt: event.date,
          openedAt: null,
          clickedAt: null,
          errorMessage: null,
        });
      }

      const record = emailMap.get(event.email)!;
      if (!record.messageId) record.messageId = event.messageId;

      switch (event.event) {
        case "delivered":
          record.status = "delivered";
          break;
        case "opened":
        case "unique_opened": {
          const eventTime = new Date(event.date).getTime();
          const sentTime = record.sentAt ? new Date(record.sentAt).getTime() : 0;
          const diffSeconds = sentTime ? (eventTime - sentTime) / 1000 : Infinity;
          if (diffSeconds < 120) {
            console.log(`Ignoring suspicious open for ${event.email}: ${diffSeconds.toFixed(1)}s after send`);
            break;
          }
          if (!record.openedAt) record.openedAt = event.date;
          if (record.status !== "delivered") record.status = "delivered";
          break;
        }
        case "click":
          if (!record.clickedAt) record.clickedAt = event.date;
          if (record.status !== "delivered") record.status = "delivered";
          break;
        case "hard_bounce":
        case "soft_bounce":
          record.status = "bounced";
          record.errorMessage = event.event;
          break;
        case "blocked":
          record.status = "blocked";
          record.errorMessage = "blocked";
          break;
        case "spam":
          record.status = "spam";
          break;
        case "error":
          record.status = "failed";
          record.errorMessage = "delivery error";
          break;
      }
    }

    console.log(`Unique recipients found: ${emailMap.size}`);

    // Upsert into email_sends
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const [email, record] of emailMap) {
      const { data: existing } = await supabase
        .from("email_sends")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("recipient_email", email)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("email_sends")
          .update({
            status: record.status,
            brevo_message_id: record.messageId,
            opened_at: record.openedAt,
            clicked_at: record.clickedAt,
            error_message: record.errorMessage,
          })
          .eq("id", existing.id);

        if (error) {
          console.error(`Update error for ${email}:`, error.message);
          errors++;
        } else {
          updated++;
        }
      } else {
        const { error } = await supabase
          .from("email_sends")
          .insert({
            organization_id: organizationId,
            campaign_id: campaignId,
            recipient_email: email,
            recipient_name: email.split("@")[0],
            subject: campaignSubject,
            status: record.status,
            brevo_message_id: record.messageId,
            sent_at: record.sentAt,
            opened_at: record.openedAt,
            clicked_at: record.clickedAt,
            error_message: record.errorMessage,
          });

        if (error) {
          console.error(`Insert error for ${email}:`, error.message);
          errors++;
        } else {
          inserted++;
        }
      }
    }

    // CRITICAL: Always recalculate metrics from email_sends (source of truth)
    const metrics = await recalculateMetricsFromSends(supabase, campaignId);

    // Only update if we have real data — never overwrite with zeros
    if (metrics.total > 0) {
      await supabase
        .from("email_campaigns")
        .update({
          total_recipients: metrics.total,
          sent_count: metrics.sent,
          failed_count: metrics.failed,
        })
        .eq("id", campaignId);
    }

    const summary = { inserted, updated, errors, totalEvents: relevantEvents.length, uniqueRecipients: metrics.total };
    console.log("Sync complete:", summary);

    return new Response(
      JSON.stringify({ success: true, ...summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-campaign-sends error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Recalculate campaign metrics from email_sends table (source of truth) */
async function recalculateMetricsFromSends(
  supabase: ReturnType<typeof createClient>,
  campaignId: string
): Promise<{ total: number; sent: number; failed: number }> {
  const { data: sends, error } = await supabase
    .from("email_sends")
    .select("recipient_email, status")
    .eq("campaign_id", campaignId);

  if (error || !sends || sends.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  // Deduplicate by email, keeping the "best" status
  const emailStatuses = new Map<string, string>();
  for (const s of sends) {
    emailStatuses.set(s.recipient_email, s.status);
  }

  const total = emailStatuses.size;
  let sent = 0;
  let failed = 0;

  for (const status of emailStatuses.values()) {
    if (status === 'sent' || status === 'delivered') sent++;
    else if (status === 'failed' || status === 'bounced' || status === 'blocked' || status === 'spam') failed++;
  }

  return { total, sent, failed };
}
