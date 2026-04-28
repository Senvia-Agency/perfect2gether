import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trial/billing removed — Perfect2Gether does not use subscription plans.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(JSON.stringify({ processed: 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
