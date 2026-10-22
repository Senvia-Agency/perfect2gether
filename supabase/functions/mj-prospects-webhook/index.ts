// Called by the Apify webhook when a run of the "extrator-leads-mj" task ends.
// Imports the prospects even if nobody has the CRM open, including scheduled runs
// that were not started from the CRM. Authenticated by the x-webhook-secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { MJ_SOURCE, MJ_TASK_ID, finishMjJob } from "../_shared/mj-prospects.ts";

const APIFY_BASE = "https://api.apify.com/v2";
const P2G_ORGANIZATION_ID = "96a3950e-31be-4c6d-abed-b82968c0d7e9";
const FINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "Método não permitido" });

  const secret = Deno.env.get("MJ_WEBHOOK_SECRET");
  const apifyToken = Deno.env.get("APIFY_API_TOKEN");
  if (!secret || !apifyToken) return reply(503, { error: "Webhook não configurado" });
  if (!timingSafeEqual(req.headers.get("x-webhook-secret") ?? "", secret)) return reply(401, { error: "Não autorizado" });

  let runId: string | undefined;
  try {
    const payload = await req.json();
    runId = payload?.resource?.id ?? payload?.eventData?.actorRunId;
  } catch {
    return reply(400, { error: "Pedido inválido" });
  }
  if (!runId) return reply(400, { error: "Sem identificador da execução" });

  // Never trust the payload beyond the run id: read the run from Apify.
  const runRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apifyToken}`);
  if (!runRes.ok) return reply(502, { error: `Apify respondeu ${runRes.status}` });
  const run = (await runRes.json())?.data;
  if (run?.actorTaskId !== MJ_TASK_ID) return reply(200, { ignored: "execução de outra task" });
  if (!FINAL_STATUSES.has(run.status)) return reply(200, { ignored: `estado ${run.status}` });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const findJob = () => db.from("prospect_generation_jobs")
    .select("id, organization_id, user_id").eq("apify_run_id", runId).maybeSingle();

  let { data: job, error: findError } = await findJob();
  if (findError) return reply(500, { error: findError.message });
  if (!job) {
    const { error: createError } = await db.from("prospect_generation_jobs").insert({
      organization_id: P2G_ORGANIZATION_ID,
      user_id: null,
      apify_run_id: runId,
      status: "running",
      search_params: { source: MJ_SOURCE, scheduled: true },
    });
    if (createError && createError.code !== "23505") return reply(500, { error: createError.message });
    ({ data: job, error: findError } = await findJob());
    if (findError || !job) return reply(500, { error: findError?.message ?? "Job não criado" });
  }

  try {
    const outcome = await finishMjJob(db, job, run.status, async () => {
      const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${apifyToken}&format=json`);
      return res.json();
    });
    return reply(200, outcome ?? { skipped: "já processada" });
  } catch (err) {
    return reply(500, { error: err instanceof Error ? err.message : "Erro desconhecido" });
  }
});
