// Prospects from publicacoes.mj.pt, scraped by the Apify task "extrator-leads-mj".
// The task returns one row per company: { data, nif, entidade, concelho, acto, texto, cae };
// texto is the publication body (parsed here) and cae comes from SICAE.
// A failed page yields a "#error" row.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { parseMjPublication, type MjPublication } from "./mj-publication.ts";

export const MJ_SOURCE = "mj";
export const MJ_TASK_ID = "2IADT6znTl3CUoNKO";

interface MjItem {
  data?: string | null;
  nif?: string | null;
  entidade?: string | null;
  concelho?: string | null;
  acto?: string | null;
  texto?: string | null;
  cae?: { principal?: string | null; secundarios?: string[] } | null;
  "#error"?: boolean;
  "#debug"?: { errorMessages?: string[] };
}

function formatAddress(sede: MjPublication["sede"]): string | null {
  const postal = [sede.codigo_postal, sede.localidade].filter(Boolean).join(" ");
  return [sede.morada, postal].filter(Boolean).join(", ") || null;
}

export function buildMjMetadata(row: MjItem) {
  const publication = row.texto ? parseMjPublication(row.texto, row.acto ?? "") : null;
  const sede = publication?.sede ?? { morada: null, codigo_postal: null, localidade: null, freguesia: null, concelho: null, distrito: null };
  if (!sede.concelho && row.concelho) sede.concelho = row.concelho.trim();
  const cae = row.cae?.principal ? { principal: row.cae.principal, secundarios: row.cae.secundarios ?? [] } : null;
  return {
    publication_date: row.data ?? null,
    source_portal: "publicacoes.mj.pt",
    acto: row.acto?.trim() || null,
    natureza_juridica: publication?.natureza_juridica ?? null,
    sede,
    address: formatAddress(sede),
    objeto: publication?.objeto ?? null,
    capital: publication?.capital ?? null,
    gerentes: publication?.gerentes ?? [],
    socios: publication?.socios ?? [],
    cae,
  };
}

export interface JobProgress {
  percent: number;
  label: string;
}

// Maps the log lines written by the task's pageFunction to a progress step.
// The last matching line wins, so retries move the bar back to the right step.
export function mjProgressFromLog(log: string): JobProgress {
  let progress: JobProgress = { percent: 5, label: "A iniciar o extrator…" };
  let empresas = 0;
  for (const line of log.split("\n")) {
    const captcha = line.match(/A aguardar CAPTCHA: (\d+)\/(\d+)/);
    const total = line.match(/Total encontrado: (\d+)/);
    const distrito = line.match(/Distrito (\d+)\/(\d+): (.+?)\s*$/);
    const detalhes = line.match(/Detalhes: (\d+) empresas/);
    const cae = line.match(/CAE: (\d+)\/(\d+)/);
    if (detalhes) empresas = Number(detalhes[1]);
    if (distrito) {
      const [index, count] = [Number(distrito[1]), Number(distrito[2])];
      progress = { percent: 5 + Math.round(((index - 1) / count) * 80), label: `Distrito ${index} de ${count}: ${distrito[3]}${empresas ? ` · ${empresas} empresas` : ""}` };
    } else if (detalhes) progress = { ...progress, label: progress.label.replace(/ · \d+ empresas$/, "") + ` · ${empresas} empresas` };
    else if (line.includes("A obter CAE")) progress = { percent: 85, label: `A obter o CAE de ${empresas} empresas…` };
    else if (cae) progress = { percent: 85 + Math.round((Number(cae[1]) / Number(cae[2])) * 10), label: `A obter o CAE (${cae[1]} de ${cae[2]})…` };
    else if (line.includes("Saldo CapSolver")) progress = { percent: 15, label: "A abrir o portal do MJ…" };
    else if (line.includes("publicação comercial selecionadas")) progress = { percent: 25, label: "A preparar a pesquisa…" };
    else if (line.includes("A solicitar resolução ao CapSolver")) progress = { percent: 30, label: "A resolver o CAPTCHA…" };
    else if (captcha) progress = { percent: 30 + Math.round((Number(captcha[1]) / Number(captcha[2])) * 40), label: "A resolver o CAPTCHA…" };
    else if (line.includes("CAPTCHA resolvido")) progress = { percent: 75, label: "CAPTCHA resolvido" };
    else if (line.includes("A executar pesquisa")) progress = { percent: 85, label: "A pesquisar publicações…" };
    else if (total) progress = { percent: 95, label: `${total[1]} empresas encontradas, a gravar…` };
  }
  return progress;
}

export function mjRunError(items: unknown): string | null {
  if (!Array.isArray(items)) return "Resposta inválida do Apify";
  const rows = items as MjItem[];
  if (rows.some((row) => !row["#error"])) return null;
  const message = rows[0]?.["#debug"]?.errorMessages?.[0]?.split("\n")[0];
  return message ? message.replace(/^Error:\s*/, "") : "O extrator não devolveu empresas";
}

const CHUNK = 150;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function knownNifs(db: SupabaseClient, organizationId: string, candidates: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  for (const part of chunks(candidates)) {
    const list = part.join(",");
    const [prospects, clients, leads] = await Promise.all([
      db.from("prospects").select("nif").eq("organization_id", organizationId).in("nif", part),
      db.from("crm_clients").select("nif, company_nif").eq("organization_id", organizationId).or(`nif.in.(${list}),company_nif.in.(${list})`),
      db.from("leads").select("company_nif").eq("organization_id", organizationId).in("company_nif", part),
    ]);
    if (prospects.error) throw prospects.error;
    if (clients.error) throw clients.error;
    if (leads.error) throw leads.error;
    for (const row of prospects.data ?? []) known.add(String(row.nif));
    for (const row of leads.data ?? []) known.add(String(row.company_nif));
    for (const row of clients.data ?? []) {
      if (row.nif) known.add(String(row.nif));
      if (row.company_nif) known.add(String(row.company_nif));
    }
  }
  return known;
}

export async function importMjProspects(
  db: SupabaseClient,
  organizationId: string,
  userId: string | null,
  items: unknown[],
): Promise<{ inserted: number; updated: number; skipped: number; total: number }> {
  const rows = (items as MjItem[]).filter((row) => !row["#error"]);
  const candidates = [...new Set(rows.map((row) => (row.nif ?? "").replace(/\D/g, "")).filter((nif) => nif.length === 9))];
  const known = await knownNifs(db, organizationId, candidates);

  const now = new Date().toISOString();
  const payload = [];
  for (const row of rows) {
    const nif = (row.nif ?? "").replace(/\D/g, "");
    const name = (row.entidade ?? "").trim();
    if (nif.length !== 9 || !name || known.has(nif)) continue;
    known.add(nif);
    const metadata = buildMjMetadata(row);
    const contact = metadata.gerentes[0] ?? metadata.socios[0] ?? null;
    payload.push({
      organization_id: organizationId,
      company_name: name,
      nif,
      contact_name: contact?.nome ?? null,
      email: metadata.gerentes.find((person) => person.email)?.email ?? null,
      source: "apify_mj",
      source_file_name: `Publicações MJ: ${row.data ?? now.slice(0, 10)}`,
      imported_by: userId,
      imported_at: now,
      metadata,
      status: "new",
    });
  }

  // Unassigned prospects must have unique emails (ux_prospects_org_email_unassigned_dedupe):
  // drop repeated or already used emails instead of failing the whole batch.
  const emails = [...new Set(payload.map((row) => row.email).filter((email): email is string => !!email))];
  const taken = new Set<string>();
  for (const part of chunks(emails)) {
    const { data: used, error } = await db.from("prospects").select("email")
      .eq("organization_id", organizationId).eq("converted_to_lead", false).in("email", part);
    if (error) throw error;
    for (const row of used ?? []) taken.add(String(row.email).toLowerCase());
  }
  for (const row of payload) {
    if (!row.email) continue;
    if (taken.has(row.email)) row.email = null;
    else taken.add(row.email);
  }

  for (const part of chunks(payload)) {
    let { error } = await db.from("prospects").insert(part);
    if (error?.code === "23505") {
      for (const row of part) row.email = null;
      ({ error } = await db.from("prospects").insert(part));
    }
    if (error) throw error;
  }
  return { inserted: payload.length, updated: 0, skipped: rows.length - payload.length, total: rows.length };
}

export interface MjJob {
  id: string;
  organization_id: string;
  user_id: string | null;
}

export type MjJobOutcome =
  | { status: "completed"; result: Awaited<ReturnType<typeof importMjProspects>> }
  | { status: "failed"; error: string };

// Both the Apify webhook and the browser polling can finish a run. Moving the job
// from "running" to "importing" is the lock: only the caller that wins imports.
export async function finishMjJob(
  db: SupabaseClient,
  job: MjJob,
  runStatus: string,
  loadItems: () => Promise<unknown>,
): Promise<MjJobOutcome | null> {
  const { data: claimed, error: claimError } = await db.from("prospect_generation_jobs")
    .update({ status: "importing" }).eq("id", job.id).eq("status", "running").select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return null;

  let outcome: MjJobOutcome;
  try {
    if (runStatus !== "SUCCEEDED") throw new Error(`O extrator terminou com o estado ${runStatus}`);
    const items = await loadItems();
    const runError = mjRunError(items);
    if (runError) throw new Error(runError);
    outcome = { status: "completed", result: await importMjProspects(db, job.organization_id, job.user_id, items as unknown[]) };
  } catch (err) {
    outcome = { status: "failed", error: err instanceof Error ? err.message : "Erro desconhecido" };
  }

  const { error } = await db.from("prospect_generation_jobs").update(outcome.status === "completed"
    ? { status: "completed", result: outcome.result, completed_at: new Date().toISOString() }
    : { status: "failed", error: outcome.error, completed_at: new Date().toISOString() }).eq("id", job.id);
  if (error) throw error;
  return outcome;
}