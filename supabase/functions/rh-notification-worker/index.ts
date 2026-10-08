import { processRhStorageCleanups, cleanupSchema } from "./cleanup.ts";
import ky, { HTTPError } from "npm:ky@1.10.0";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import {
  queuedEmailSchema,
  processRhEmails,
  isRhSchedulerAuthorized,
  RhDeliveryUncertainError,
} from "./core.ts";
const requestSchema = z.object({
  organization_id: z.string().uuid(),
  dry_run: z.boolean().default(true),
});
serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  try {
    const payload = requestSchema.parse(await request.json());
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service)
      throw new Error("Worker configuration missing");
    const db = createClient(url, service);
    const scheduled = isRhSchedulerAuthorized({
      configuredBearer: service,
      suppliedBearer: request.headers.get("Authorization"),
      configuredSecret: Deno.env.get("RH_WORKER_SECRET"),
      suppliedSecret: request.headers.get("x-rh-worker-secret"),
      configuredOrg: Deno.env.get("RH_WORKER_ORGANIZATION_ID"),
      requestedOrg: payload.organization_id,
    });
    if (request.headers.has("x-rh-worker-secret") && !scheduled)
      return new Response("Forbidden", { status: 403 });
    const bearer = request.headers.get("Authorization");
    if (!scheduled && !bearer)
      return new Response("Unauthorized", { status: 401 });
    const actor = scheduled
      ? db
      : createClient(url, anon, {
          global: { headers: { Authorization: bearer ?? "" } },
        });
    if (!scheduled) {
      const { data: allowed, error: permissionError } = await actor.rpc(
        "rh_can",
        {
          _org: payload.organization_id,
          _area: "communication",
          _action: "manage",
        },
      );
      if (permissionError || allowed !== true)
        return new Response("Forbidden", { status: 403 });
    }
    if (
      !payload.dry_run &&
      !scheduled &&
      Deno.env.get("RH_EMAIL_DELIVERY_ENABLED") !== "true"
    )
      return new Response("Email delivery disabled", { status: 409 });
    if (!payload.dry_run) {
      const { error: tickError } = await actor.rpc("rh_notification_tick", {
        _org: payload.organization_id,
      });
      if (tickError) throw tickError;
      const { data: cleanupData, error: cleanupError } = await db.rpc(
        "rh_storage_cleanup_claim",
        { _org: payload.organization_id },
      );
      if (cleanupError) throw cleanupError;
      await processRhStorageCleanups(
        z.array(cleanupSchema).parse(cleanupData),
        {
          remove: async (path) => {
            const { error } = await db.storage
              .from("rh-private")
              .remove([path]);
            if (error) throw new Error(error.message);
          },
          complete: async (job, state, error) => {
            const { error: updateError } = await db
              .from("rh_storage_cleanup")
              .update({ state, last_error: error ?? null })
              .eq("id", job.id)
              .eq("organization_id", payload.organization_id)
              .eq("state", "processing")
              .eq("claimed_at", job.claimed_at);
            if (updateError) throw updateError;
          },
        },
      );
      if (Deno.env.get("RH_EMAIL_DELIVERY_ENABLED") !== "true")
        return Response.json({ dry_run: false, email_delivery_enabled: false });
    }
    const { data, error } = await actor.rpc("rh_email_claim", {
      _org: payload.organization_id,
      _dry_run: payload.dry_run,
    });
    if (error) throw error;
    const rows: z.infer<typeof queuedEmailSchema>[] = [];
    const invalidResults: { id: string; state: "failed"; error: string }[] = [];
    for (const entry of z.array(z.unknown()).parse(data)) {
      const parsed = queuedEmailSchema.safeParse(entry);
      if (parsed.success) {
        rows.push(parsed.data);
        continue;
      }
      const metadata = z
        .object({
          id: z.string().uuid(),
          claimed_at: z.string().nullable().optional(),
        })
        .parse(entry);
      if (!payload.dry_run) {
        const { error: invalidError } = await db
          .from("rh_notifications")
          .update({
            state: "failed",
            attempts: 5,
            last_error: "Dados de email inválidos",
          })
          .eq("id", metadata.id)
          .eq("organization_id", payload.organization_id)
          .eq("state", "processing")
          .eq("claimed_at", metadata.claimed_at ?? "");
        if (invalidError) throw invalidError;
      }
      invalidResults.push({
        id: metadata.id,
        state: "failed",
        error: "Dados de email inválidos",
      });
    }
    if (
      !payload.dry_run &&
      Deno.env.get("RH_EMAIL_DELIVERY_ENABLED") !== "true"
    )
      return new Response("Email delivery disabled", { status: 409 });
    let token = Deno.env.get("BREVO_API_KEY");
    let sender = Deno.env.get("RH_EMAIL_SENDER");
    let senderName = "Recursos Humanos";
    if (!payload.dry_run && rows.length) {
      const { data: organization, error: orgError } = await db
        .from("organizations")
        .select("name,brevo_api_key,brevo_sender_email")
        .eq("id", payload.organization_id)
        .single();
      if (orgError) throw orgError;
      const config = z
        .object({
          name: z.string(),
          brevo_api_key: z.string().nullable(),
          brevo_sender_email: z.string().nullable(),
        })
        .parse(organization);
      token = config.brevo_api_key || token;
      sender = config.brevo_sender_email || sender;
      senderName = config.name;
    }
    const results = await processRhEmails(rows, {
      now: new Date(),
      dryRun: payload.dry_run,
      deliver: async (message) => {
        const claimed = rows.find((row) => row.id === message.idempotencyKey);
        const { data: live, error: liveError } = await db
          .from("rh_notifications")
          .select("state,claimed_at")
          .eq("id", message.idempotencyKey)
          .eq("organization_id", payload.organization_id)
          .maybeSingle();
        if (
          liveError ||
          !live ||
          live.state !== "processing" ||
          live.claimed_at !== claimed?.claimed_at
        )
          throw new Error("Notification claim cancelled or expired");
        if (!token || !sender)
          throw new Error("Email transport not configured");
        const { data: marked, error: markError } = await db
          .from("rh_notifications")
          .update({ delivery_started_at: new Date().toISOString() })
          .eq("id", message.idempotencyKey)
          .eq("state", "processing")
          .eq("claimed_at", claimed?.claimed_at ?? "")
          .select("id")
          .maybeSingle();
        if (markError || !marked)
          throw new Error("Notification claim cancelled or expired");
        try {
          await ky.post("https://api.brevo.com/v3/smtp/email", {
            headers: { "api-key": token },
            json: {
              sender: { email: sender, name: senderName },
              to: [{ email: message.to }],
              subject: message.subject,
              textContent: message.body,
              headers: { idempotencyKey: message.idempotencyKey },
            },
            timeout: 15000,
            retry: 0,
          });
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          if (
            error instanceof HTTPError &&
            error.response.status >= 400 &&
            error.response.status < 500 &&
            error.response.status !== 408
          )
            throw error;
          throw new RhDeliveryUncertainError(error.message);
        }
      },
      complete: async (id, state, deliveryError) => {
        const { error: updateError } = await db
          .from("rh_notifications")
          .update({
            state,
            delivered_at:
              state === "delivered" ? new Date().toISOString() : null,
            last_error: deliveryError ?? null,
            ...(state === "failed" ? { delivery_started_at: null } : {}),
            due_at:
              state === "failed"
                ? new Date(Date.now() + 60000).toISOString()
                : new Date().toISOString(),
          })
          .eq("id", id)
          .eq("organization_id", payload.organization_id)
          .eq("state", "processing")
          .eq(
            "claimed_at",
            rows.find((row) => row.id === id)?.claimed_at ?? "",
          );
        if (updateError) throw updateError;
      },
    });
    return Response.json({
      dry_run: payload.dry_run,
      results: [...invalidResults, ...results],
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Worker failed" },
      { status: 400 },
    );
  }
});
