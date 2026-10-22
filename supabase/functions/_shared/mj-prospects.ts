// Prospects from publicacoes.mj.pt, scraped by the Apify task "extrator-leads-mj".
// The task returns { data, nif, entidade } rows; a failed page yields a "#error" row.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export const MJ_SOURCE = "mj";
export const MJ_TASK_ID = "2IADT6znTl3CUoNKO";

interface MjItem {
  data?: string | null;
  nif?: string | null;
  entidade?: string | null;
  "#error"?: boolean;
  "#debug"?: { errorMessages?: string[] };
}

export interface JobProgress {
  percent: number;
  label: string;
}

// Maps the log lines written by the task's pageFunction to a progress step.
// The last matching line wins, so retries move the bar back to the right step.
export function mjProgressFromLog(log: string): JobProgress {
  let progress: JobProgress = { percent: 5, label: "A iniciar o extrator…" };
  for (const line of log.split("\n")) {
    const captcha = line.match(/A aguardar CAPTCHA: (\d+)\/(\d+)/);
    const total = line.match(/Total encontrado: (\d+)/);
    if (line.includes("Saldo CapSolver")) progress = { percent: 15, label: "A abrir o portal do MJ…" };
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

export async function importMjProspects(
  db: SupabaseClient,
  organizationId: string,
  userId: string,
  items: unknown[],
): Promise<{ inserted: number; updated: number; skipped: number; total: number }> {
  const rows = (items as MjItem[]).filter((row) => !row["#error"]);
  const candidates = [...new Set(rows.map((row) => (row.nif ?? "").replace(/\D/g, "")).filter((nif) => nif.length === 9))];
  const known = new Set<string>();

  if (candidates.length) {
    const list = candidates.join(",");
    const [prospects, clients, leads] = await Promise.all([
      db.from("prospects").select("nif").eq("organization_id", organizationId).in("nif", candidates),
      db.from("crm_clients").select("nif, company_nif").eq("organization_id", organizationId).or(`nif.in.(${list}),company_nif.in.(${list})`),
      db.from("leads").select("company_nif").eq("organization_id", organizationId).in("company_nif", candidates),
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

  const now = new Date().toISOString();
  const payload = [];
  for (const row of rows) {
    const nif = (row.nif ?? "").replace(/\D/g, "");
    const name = (row.entidade ?? "").trim();
    if (nif.length !== 9 || !name || known.has(nif)) continue;
    known.add(nif);
    payload.push({
      organization_id: organizationId,
      company_name: name,
      nif,
      source: "apify_mj",
      source_file_name: `Publicações MJ: ${row.data ?? now.slice(0, 10)}`,
      imported_by: userId,
      imported_at: now,
      metadata: { publication_date: row.data ?? null, source_portal: "publicacoes.mj.pt" },
      status: "new",
    });
  }

  if (payload.length) {
    const { error } = await db.from("prospects").insert(payload);
    if (error) throw error;
  }
  return { inserted: payload.length, updated: 0, skipped: rows.length - payload.length, total: rows.length };
}
