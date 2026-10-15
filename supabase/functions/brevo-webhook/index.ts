import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { z } from "https://esm.sh/zod@3.25.76";

const eventSchema = z.object({
  event: z.string().min(1),
  "message-id": z.string().optional(),
  messageId: z.string().optional(),
  reason: z.string().optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response(null, { status: 405 });

  try {
    const expectedToken = Deno.env.get("BREVO_WEBHOOK_TOKEN");
    if (!expectedToken) return new Response(null, { status: 503 });
    const authorization = req.headers.get("authorization") || "";
    const providedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const encoder = new TextEncoder();
    const [expectedHash, providedHash] = await Promise.all([
      crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
      crypto.subtle.digest("SHA-256", encoder.encode(providedToken)),
    ]);
    const expectedBytes = new Uint8Array(expectedHash);
    const providedBytes = new Uint8Array(providedHash);
    let difference = 0;
    expectedBytes.forEach((byte, index) => { difference |= byte ^ providedBytes[index]; });
    if (!providedToken || difference !== 0) return new Response(null, { status: 401 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const parsed = eventSchema.safeParse(await req.json());
    if (!parsed.success) return new Response(null, { status: 400 });
    const payload = parsed.data;
    const event = payload.event;
    const messageId = payload["message-id"] || payload.messageId;

    if (!messageId || !event) {
      return new Response(JSON.stringify({ error: "Missing event or message-id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Brevo webhook: event=${event}, messageId=${messageId}`);

    const updateData: Record<string, string> = {};

    switch (event) {
      case "delivered":
        updateData.status = "delivered";
        break;
      case "opened":
      case "uniqueOpened":
      case "unique_opened":
        updateData.opened_at = new Date().toISOString();
        break;
      case "clicks":
      case "click":
        updateData.clicked_at = new Date().toISOString();
        break;
      case "hardBounce":
      case "softBounce":
      case "hard_bounce":
      case "soft_bounce":
        updateData.status = "bounced";
        updateData.error_message = `${event}: ${payload.reason || ""}`;
        break;
      case "blocked":
        updateData.status = "blocked";
        updateData.error_message = payload.reason || "Blocked";
        break;
      case "spam":
        updateData.status = "spam";
        break;
      case "unsubscribed":
        updateData.status = "unsubscribed";
        break;
      default:
        console.log(`Unhandled event: ${event}`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error } = await supabase
      .from("email_sends")
      .update(updateData)
      .eq("brevo_message_id", String(messageId));

    if (error) {
      console.error("Error updating email_sends:", error);
      return new Response(null, { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Brevo webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
