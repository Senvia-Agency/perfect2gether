import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "2Mdma1N6Fd0y3QEjR";

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

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Pedido inválido. Envie os parâmetros em JSON." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      organizationId,
      searchStrings = [],
      location = "",
      maxResults = 50,
      language = "pt-PT",
      skipClosed = true,
      searchMatching = "all",
      placeMinimumStars = "",
      website = "allPlaces",
      scrapePlaceDetailPage = false,
      scrapeTableReservationProvider = false,
      includeWebResults = false,
      scrapeDirectories = false,
      maxQuestions = 0,
      scrapeContacts = false,
      scrapeSocialMediaProfiles = { facebooks: false, instagrams: false, youtubes: false, tiktoks: false, twitters: false },
      maximumLeadsEnrichmentRecords = 0,
      startUrls = [],
    } = body;

    const normalizedLanguage = (() => {
      const raw = String(language || "pt-PT").trim();
      const alias: Record<string, string> = {
        pt: "pt-PT",
        "pt-pt": "pt-PT",
        "pt_pt": "pt-PT",
        br: "pt-BR",
        "pt-br": "pt-BR",
        "pt_br": "pt-BR",
      };

      return alias[raw.toLowerCase()] ?? raw;
    })();

    const allowedLanguages = new Set(["pt-PT", "pt-BR", "en", "es", "fr"]);
    if (!allowedLanguages.has(normalizedLanguage)) {
      return new Response(
        JSON.stringify({
          error:
            "Idioma inválido. Use um dos seguintes: pt-PT, pt-BR, en, es, fr.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organizationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!startUrls.length && (!searchStrings.length || !location)) {
      return new Response(JSON.stringify({ error: "searchStrings+location or startUrls are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Apify actor input
    const actorInput: Record<string, unknown> = {
      searchStringsArray: searchStrings,
      locationQuery: location,
      maxCrawledPlacesPerSearch: maxResults,
      language: normalizedLanguage,
      searchMatching,
      placeMinimumStars,
      website,
      skipClosedPlaces: skipClosed,
      scrapePlaceDetailPage,
      scrapeTableReservationProvider,
      includeWebResults,
      scrapeDirectories,
      maxQuestions,
      scrapeContacts,
      scrapeSocialMediaProfiles,
      maximumLeadsEnrichmentRecords,
    };

    if (startUrls.length) {
      actorInput.startUrls = startUrls.map((url: string) => ({ url }));
    }

    // Start Apify actor run (don't wait for completion)
    const runRes = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actorInput),
    });

    if (!runRes.ok) {
      const errText = await runRes.text();
      return new Response(
        JSON.stringify({ error: `Apify start failed [${runRes.status}]: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runData = await runRes.json();
    const runId = runData?.data?.id;
    if (!runId) {
      return new Response(JSON.stringify({ error: "No run ID returned from Apify" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save job to database using service role
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: job, error: jobError } = await serviceSupabase
      .from("prospect_generation_jobs")
      .insert({
        organization_id: organizationId,
        user_id: userData.user.id,
        apify_run_id: runId,
        status: "running",
        search_params: body,
      })
      .select("id")
      .single();

    if (jobError) {
      return new Response(
        JSON.stringify({ error: `Failed to save job: ${jobError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ jobId: job.id, apifyRunId: runId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-prospects error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
