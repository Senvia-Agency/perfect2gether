import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE = "https://api.apify.com/v2";

interface ApifyItem {
  title?: string;
  phone?: string;
  phones?: string[];
  website?: string;
  emails?: string[];
  address?: string;
  categoryName?: string;
  totalScore?: number;
  url?: string;
  city?: string;
  postalCode?: string;
  reviewsCount?: number;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  [key: string]: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      return new Response(JSON.stringify({ error: "APIFY_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get job
    const { data: job, error: jobError } = await serviceSupabase
      .from("prospect_generation_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If already completed/failed, return cached result
    if (job.status === "completed" || job.status === "failed") {
      return new Response(JSON.stringify({
        status: job.status,
        result: job.result,
        error: job.error,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check Apify run status
    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${job.apify_run_id}?token=${APIFY_API_TOKEN}`
    );
    const statusData = await statusRes.json();
    const apifyStatus = statusData?.data?.status || "FAILED";

    if (apifyStatus === "RUNNING" || apifyStatus === "READY") {
      return new Response(JSON.stringify({ status: "running" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (apifyStatus !== "SUCCEEDED") {
      await serviceSupabase
        .from("prospect_generation_jobs")
        .update({ status: "failed", error: `Apify run ended with status: ${apifyStatus}`, completed_at: new Date().toISOString() })
        .eq("id", jobId);

      return new Response(JSON.stringify({
        status: "failed",
        error: `Apify run ended with status: ${apifyStatus}`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch dataset items
    const datasetRes = await fetch(
      `${APIFY_BASE}/actor-runs/${job.apify_run_id}/dataset/items?token=${APIFY_API_TOKEN}&format=json`
    );
    const items: ApifyItem[] = await datasetRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      const result = { inserted: 0, updated: 0, skipped: 0, total: 0 };
      await serviceSupabase
        .from("prospect_generation_jobs")
        .update({ status: "completed", result, completed_at: new Date().toISOString() })
        .eq("id", jobId);

      return new Response(JSON.stringify({ status: "completed", result }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process items and insert prospects
    const organizationId = job.organization_id;
    const searchParams = job.search_params as Record<string, unknown> || {};
    const searchStrings = (searchParams.searchStrings as string[]) || [];
    const location = (searchParams.location as string) || "";

    // Get existing prospects for dedup
    const { data: existing } = await serviceSupabase
      .from("prospects")
      .select("id, company_name, phone")
      .eq("organization_id", organizationId);

    const existingMap = new Map<string, string>();
    for (const row of existing || []) {
      const key = `${(row.company_name || "").toLowerCase().trim()}::${(row.phone || "").trim()}`;
      existingMap.set(key, row.id);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      const companyName = (item.title || "").trim();
      if (!companyName) {
        skipped++;
        continue;
      }

      // Use first phone from scrapeContacts array, fallback to singular phone
      const phone = (item.phones?.[0] || item.phone || "").trim();
      const dedupKey = `${companyName.toLowerCase()}::${phone}`;

      // Extract email: prefer emails array from scrapeContacts, fallback to website containing @
      const email = item.emails?.[0]?.trim() ||
        (item.website && item.website.includes("@") ? item.website : null);
      const metadata: Record<string, unknown> = {
        address: item.address || null,
        city: item.city || null,
        postal_code: item.postalCode || null,
        rating: item.totalScore || null,
        reviews_count: item.reviewsCount || null,
        google_maps_url: item.url || null,
        website: item.website && !item.website.includes("@") ? item.website : null,
        facebook: item.facebookUrl || null,
        instagram: item.instagramUrl || null,
        twitter: item.twitterUrl || null,
        youtube: item.youtubeUrl || null,
        tiktok: item.tiktokUrl || null,
        additional_emails: item.emails && item.emails.length > 1 ? item.emails.slice(1) : null,
        additional_phones: item.phones && item.phones.length > 1 ? item.phones.slice(1) : null,
        source_search: searchStrings.join(", "),
        source_location: location,
      };

      const payload = {
        organization_id: organizationId,
        company_name: companyName,
        phone: phone || null,
        email,
        segment: item.categoryName || null,
        source: "apify_google_maps",
        source_file_name: `Google Maps: ${searchStrings.join(", ")} - ${location}`,
        imported_by: job.user_id,
        imported_at: new Date().toISOString(),
        metadata,
        status: "new",
      };

      const existingId = existingMap.get(dedupKey);

      if (existingId) {
        const { error } = await serviceSupabase
          .from("prospects")
          .update(payload)
          .eq("id", existingId);
        if (!error) updated++;
        else skipped++;
      } else {
        const { error } = await serviceSupabase.from("prospects").insert(payload);
        if (!error) {
          inserted++;
          existingMap.set(dedupKey, "new");
        } else skipped++;
      }
    }

    const result = { inserted, updated, skipped, total: items.length };

    await serviceSupabase
      .from("prospect_generation_jobs")
      .update({ status: "completed", result, completed_at: new Date().toISOString() })
      .eq("id", jobId);

    return new Response(JSON.stringify({ status: "completed", result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-prospect-job error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
