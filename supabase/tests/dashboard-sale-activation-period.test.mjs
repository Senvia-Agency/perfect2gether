import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const org = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const source = ts.transpileModule(readFileSync('src/hooks/useMonthSalesMetrics.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const serviceKwpModule = {};
new Function('exports', ts.transpileModule(readFileSync('src/lib/service-kwp.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(serviceKwpModule);
const sale =(id, status = 'in_progress', activation = null) => ({ id, organization_id: org, created_by: 'consultant', proposal_id: 'proposal', sale_date: '2026-10-15', status, activation_date: activation });
const energyProposal = { id: 'proposal', proposal_type: 'energia', negotiation_type: 'angariacao', servicos_details: null, kwp: null };
function run({ sales = [sale('one')], month = '2026-10-15', organization = org, failure, proposals = [energyProposal] } = {}) {
  const tables = {
    sales,
    proposals,
    proposal_cpes: [{ proposal_id: 'proposal', consumo_anual: 41330, comissao: 74.2 }],
  };
  const supabase = { from(table) {
    const filters = [];
    const query = {
      select: () => query,
      eq: (field, value) => { filters.push(row => row[field] === value); return query; },
      neq: (field, value) => { filters.push(row => row[field] !== value); return query; },
      gte: (field, value) => { filters.push(row => row[field] != null && row[field] >= value); return query; },
      lte: (field, value) => { filters.push(row => row[field] != null && row[field] <= value); return query; },
      in: (field, values) => { filters.push(row => values.includes(row[field])); return query; },
      then: (resolve, reject) => Promise.resolve({ data: tables[table].filter(row => filters.every(filter => filter(row))), error: failure === table ? new Error('read denied') : null }).then(resolve, reject),
    };
    return query;
  } };
  const mocks = {
    '@tanstack/react-query': { useQuery: options => options },
    '@/integrations/supabase/client': { supabase },
    '@/contexts/AuthContext': { useAuth: () => ({ organization: { id: organization } }) },
    '@/lib/perfect2gether': { isPerfect2GetherOrg: id => id === org },
    '@/lib/service-kwp': serviceKwpModule,
  };
  const exports = {};
  new Function('exports', 'require', source)(exports, id => mocks[id] ?? require(id));
  return exports.useMonthSalesMetrics(new Date(month + 'T12:00:00')).queryFn();
}
const totals = rows => rows.reduce((total, row) => ({ nifs: total.nifs + row.nifs, energia: total.energia + row.energia, comissao: total.comissao + row.comissao }), { nifs: 0, energia: 0, comissao: 0 });
test('all non-cancelled sales and their indicative commissions count in the sale month', async () => {
  const rows = await run({ sales: [sale('progress'), sale('fulfilled', 'fulfilled'), sale('delivered', 'delivered'), sale('cancelled', 'cancelled')] });
  assert.deepEqual(totals(rows), { nifs: 3, energia: 41.33 * 3, comissao: 74.2 * 3 });
});
test('October sale activates in February: performance and commission stay in October', async () => {
  const sales = [sale('one', 'delivered', '2027-02-04')];
  assert.deepEqual(totals(await run({ sales })), { nifs: 1, energia: 41.33, comissao: 74.2 });
  for (const month of ['2026-11-15', '2026-12-15', '2027-01-15', '2027-03-15']) {
    assert.deepEqual(totals(await run({ sales, month })), { nifs: 0, energia: 0, comissao: 0 });
  }
  assert.deepEqual(totals(await run({ sales, month: '2027-02-15' })), { nifs: 0, energia: 0, comissao: 0 });
});
test('in-progress sale counts indicative commission once, without repeating in its activation month', async () => {
  const sales = [sale('one', 'in_progress', '2027-02-04')];
  assert.deepEqual(totals(await run({ sales })), { nifs: 1, energia: 41.33, comissao: 74.2 });
  assert.deepEqual(totals(await run({ sales, month: '2027-02-15' })), { nifs: 0, energia: 0, comissao: 0 });
});
test('same-month activation counts the sale and commission once and excludes cancellations', async () => {
  const sales = [sale('one', 'delivered', '2026-10-20'), sale('cancelled', 'cancelled', '2026-10-20')];
  assert.deepEqual(totals(await run({ sales })), { nifs: 1, energia: 41.33, comissao: 74.2 });
});

test('September sale activated in October does not displace October booked sales', async () => {
  const sales = [
    { ...sale('september', 'delivered', '2026-10-05'), sale_date: '2026-09-29' },
    sale('october', 'fulfilled'),
  ];
  assert.deepEqual(totals(await run({ sales })), { nifs: 1, energia: 41.33, comissao: 74.2 });
});

test('other organizations retain their existing fulfilled-only rules', async () => {
  const organization = 'other';
  const sales = [sale('one', 'fulfilled'), sale('two', 'in_progress')].map(row => ({ ...row, organization_id: organization }));
  assert.deepEqual(totals(await run({ sales, organization })), { nifs: 1, energia: 41.33, comissao: 74.2 });
});
test('failed source reads are reported rather than displaying incomplete totals', async () => {
  for (const failure of ['sales', 'proposals', 'proposal_cpes']) await assert.rejects(() => run({ failure }), /read denied/);
});
test('creating, editing, cancelling and deleting sales refreshes monthly dashboard totals', async () => {
  const compiled = ts.transpileModule(readFileSync('src/hooks/useSales.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const keys = [];
  const mocks = {
    '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => ({ invalidateQueries: options => keys.push(options.queryKey[0]) }) },
    '@/integrations/supabase/client': { supabase: {} },
    '@/contexts/AuthContext': { useAuth: () => ({ organization: { id: org }, user: { id: 'consultant' } }) },
    '@/hooks/useTeamFilter': {},
    sonner: { toast: { success() {}, error() {} } },
  };
  const exports = {};
  new Function('exports', 'require', compiled)(exports, id => mocks[id] ?? require(id));
  for (const name of ['useCreateSale', 'useCreateSaleFromProposal', 'useUpdateSaleStatus', 'useUpdateSale', 'useDeleteSale']) {
    keys.length = 0;
    await exports[name]().onSuccess({});
    assert.ok(keys.includes('month-sales-metrics'), name);
  }
});

test('administrator-created sale belongs to the assigned client consultant', async () => {
 const rows = await run({ sales: [{ ...sale('0016', 'delivered', '2026-10-26'), created_by: 'admin', client: { assigned_to: 'filipe' }, lead: { assigned_to: 'other' } }] });
 assert.deepEqual(rows, [{userId:'filipe', nifs:1, energia:41.33, solar:0, comissao:74.2}]);
});
test('unassigned client falls back to the lead consultant then the creator', async () => {
 const rows = await run({ sales: [{...sale('lead'), client:{assigned_to:null}, lead:{assigned_to:'lead-consultant'}}, sale('creator')] });
 assert.deepEqual(rows.map(row => row.userId), ['lead-consultant','consultant']);
});

test('solar sale counts its kWp in Vendas (coverings excluded) without energy or commission', async () => {
 const solarProposal = { id: 'solar', proposal_type: 'servicos', negotiation_type: null, kwp: null, servicos_details: { Paineis: { name: 'Painéis Solares', kwp: 12.5 }, Coberturas: { name: 'Coberturas', kwp: 3 } } };
 const rows = await run({ sales: [{ ...sale('solar'), proposal_id: 'solar' }], proposals: [solarProposal] });
 assert.deepEqual(rows, [{ userId: 'consultant', nifs: 1, energia: 0, solar: 12.5, comissao: 0 }]);
});
test('legacy solar proposal with only top-level kWp still counts', async () => {
 const legacy = { id: 'legacy', proposal_type: 'servicos', negotiation_type: null, kwp: 8, servicos_details: null };
 const rows = await run({ sales: [{ ...sale('legacy'), proposal_id: 'legacy' }], proposals: [legacy] });
 assert.equal(rows[0].solar, 8);
});
test('solar sale without a proposal uses the kWp recorded on the sale', async () => {
 const rows = await run({ sales: [{ ...sale('direct'), proposal_id: null, proposal_type: 'servicos', kwp: null, servicos_details: { Paineis: { kwp: 6 } } }], proposals: [] });
 assert.equal(rows[0].solar, 6);
});
test('energy sales never add solar kWp', async () => {
 const rows = await run({ proposals: [{ ...energyProposal, kwp: 99 }] });
 assert.equal(rows[0].solar, 0);
});
