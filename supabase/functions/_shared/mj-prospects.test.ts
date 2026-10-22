import { finishMjJob, importMjProspects, mjProgressFromLog } from "./mj-prospects.ts";

type Row = Record<string, unknown>;

function fakeDb(existing: Record<string, Row[]>, insertError?: { code: string }, claimed = true) {
  const inserted: Row[][] = [];
  const updates: Row[] = [];
  const from = (name: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      or: () => query,
      update: (values: Row) => { updates.push(values); return query; },
      maybeSingle: () => Promise.resolve({ data: claimed ? { id: "job" } : null, error: null }),
      insert: (rows: Row[]) => {
        inserted.push(rows.map((row) => ({ ...row })));
        const error = insertError && inserted.length === 1 ? insertError : null;
        return Promise.resolve({ error });
      },
      then: (resolve: (value: unknown) => void) => resolve({ data: existing[name] ?? [], error: null }),
    };
    return query;
  };
  return { db: { from } as unknown as Parameters<typeof importMjProspects>[0], inserted, updates };
}

const TEXT = (email: string) => `Publica-se que em relação à entidade:
Natureza Jurídica: SOCIEDADE POR QUOTAS
Sede: Rua Teste, 1
Distrito: Porto Concelho: Maia Freguesia: Moreira
4470 - 000 Maia
foi efectuado o seguinte acto de registo:
Insc. 1 - CONSTITUIÇÃO DE SOCIEDADE, DESIGNAÇÃO DE MEMBRO(S) DE ÓRGÃO(S) SOCIAL(AIS)
GERÊNCIA:
Nome/Firma: GERENTE TESTE
NIF/NIPC: 999999999
Cargo: Gerente
Endereço eletrónico: ${email}
`;

Deno.test("grava morada, gerente, contacto e CAE; ignora NIFs conhecidos", async () => {
  const { db, inserted } = fakeDb({ leads: [{ company_nif: "333333333" }] });
  const result = await importMjProspects(db, "org", "user", [
    { data: "2026-10-22", nif: "444444444", entidade: "NOVA, LDA", concelho: "Maia", acto: "Constituição de sociedade", texto: TEXT("g@nova.pt"), cae: { principal: "58290", secundarios: ["62100"] } },
    { data: "2026-10-22", nif: "333333333", entidade: "JÁ LEAD, LDA" },
    { "#error": true },
  ]);
  if (result.inserted !== 1 || result.skipped !== 1) throw new Error(JSON.stringify(result));
  const row = inserted[0][0] as Row & { metadata: Record<string, unknown> };
  const sede = row.metadata.sede as Record<string, string>;
  const checks = [
    row.contact_name === "GERENTE TESTE",
    row.email === "g@nova.pt",
    sede.distrito === "Porto" && sede.concelho === "Maia" && sede.codigo_postal === "4470-000",
    row.metadata.address === "Rua Teste, 1, 4470-000 Maia",
    JSON.stringify(row.metadata.cae) === JSON.stringify({ principal: "58290", secundarios: ["62100"] }),
    (row.metadata.gerentes as unknown[]).length === 1,
  ];
  if (checks.includes(false)) throw new Error(`falhou: ${JSON.stringify(checks)} ${JSON.stringify(row)}`);
});

Deno.test("sem texto da publicação usa o concelho da lista", async () => {
  const { db, inserted } = fakeDb({});
  await importMjProspects(db, "org", "user", [{ data: "2026-10-22", nif: "555555555", entidade: "SÓ LISTA, LDA", concelho: "Tomar" }]);
  const meta = inserted[0][0].metadata as { sede: { concelho: string }; gerentes: unknown[]; cae: unknown };
  if (meta.sede.concelho !== "Tomar" || meta.gerentes.length !== 0 || meta.cae !== null) throw new Error(JSON.stringify(meta));
});

Deno.test("email repetido ou já usado fica vazio para não falhar o lote", async () => {
  const { db, inserted } = fakeDb({ prospects: [{ email: "usado@x.pt" }] });
  await importMjProspects(db, "org", "user", [
    { nif: "111111111", entidade: "A", texto: TEXT("rep@x.pt") },
    { nif: "222222222", entidade: "B", texto: TEXT("rep@x.pt") },
    { nif: "666666666", entidade: "C", texto: TEXT("usado@x.pt") },
  ]);
  const emails = inserted[0].map((row) => row.email);
  if (JSON.stringify(emails) !== JSON.stringify(["rep@x.pt", null, null])) throw new Error(JSON.stringify(emails));
});

Deno.test("conflito de email na base de dados: repete o lote sem emails", async () => {
  const { db, inserted } = fakeDb({}, { code: "23505" });
  const result = await importMjProspects(db, "org", "user", [{ nif: "777777777", entidade: "D", texto: TEXT("d@x.pt") }]);
  if (inserted.length !== 2 || inserted[1][0].email !== null || result.inserted !== 1) throw new Error(JSON.stringify(inserted));
});

Deno.test("lote grande é inserido em blocos", async () => {
  const { db, inserted } = fakeDb({});
  const items = Array.from({ length: 320 }, (_, i) => ({ nif: String(100000000 + i), entidade: `E${i}` }));
  const result = await importMjProspects(db, "org", null, items);
  if (result.inserted !== 320 || inserted.length !== 3 || inserted[0].length !== 150) throw new Error(`${result.inserted} ${inserted.map((b) => b.length)}`);
});

Deno.test("finishMjJob: quem não obtém a reserva não importa", async () => {
  const { db, inserted } = fakeDb({}, undefined, false);
  let loaded = false;
  const outcome = await finishMjJob(db, { id: "job", organization_id: "org", user_id: null }, "SUCCEEDED", async () => { loaded = true; return []; });
  if (outcome !== null || loaded || inserted.length) throw new Error("importou sem reserva");
});

Deno.test("finishMjJob: execução falhada fica registada como falhada", async () => {
  const { db, updates } = fakeDb({});
  const outcome = await finishMjJob(db, { id: "job", organization_id: "org", user_id: null }, "TIMED-OUT", async () => []);
  if (outcome?.status !== "failed" || updates.at(-1)?.status !== "failed") throw new Error(JSON.stringify({ outcome, updates }));
});

Deno.test("finishMjJob: execução com sucesso importa e conclui", async () => {
  const { db, updates, inserted } = fakeDb({});
  const outcome = await finishMjJob(db, { id: "job", organization_id: "org", user_id: "u" }, "SUCCEEDED", async () => [{ nif: "123456789", entidade: "X" }]);
  if (outcome?.status !== "completed" || outcome.result.inserted !== 1 || updates.at(-1)?.status !== "completed" || inserted.length !== 1) throw new Error(JSON.stringify(outcome));
});

Deno.test("progresso por distrito, detalhes e CAE", () => {
  const log = [
    "INFO Saldo CapSolver: $5",
    "INFO Distrito 1/4: Aveiro",
    "INFO Detalhes: 12 empresas",
    "INFO Distrito 3/4: Braga",
  ].join("\n");
  const atDistrict = mjProgressFromLog(log);
  if (atDistrict.percent !== 45 || atDistrict.label !== "Distrito 3 de 4: Braga · 12 empresas") throw new Error(JSON.stringify(atDistrict));
  const atCae = mjProgressFromLog(`${log}\nINFO A obter CAE: 20 empresas\nINFO CAE: 10/20`);
  if (atCae.percent !== 90 || atCae.label !== "A obter o CAE (10 de 20)…") throw new Error(JSON.stringify(atCae));
});

Deno.test("progresso continua a reconhecer as etapas", () => {
  const p = mjProgressFromLog("INFO Saldo CapSolver: $5\nINFO CAPTCHA resolvido pelo CapSolver.");
  if (p.percent !== 75) throw new Error(JSON.stringify(p));
});
