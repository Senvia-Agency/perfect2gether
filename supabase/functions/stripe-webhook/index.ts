import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Stripe removed — Perfect2Gether does not use subscription billing.
serve(async (_req) => {
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
