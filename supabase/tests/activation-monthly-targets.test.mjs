import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const org = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const source = ts.transpileModule(readFileSync('src/hooks/useActivationObjectives.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function run({ organization = org, month = '2026-10-15', energy = 312.5, solar = 18.25, missing = false, loading = false, activations = [] } = {}) {
  const exports = {};
  let requestedMonth;
  const objective = { user_id: 'consultant', total_energia_mwh: energy, total_solar_kwp: solar };
  const mocks = {
    react: { useCallback: fn => fn },
    '@tanstack/react-query': {
      useQuery: options => ({ data: options.queryKey[0] === 'activation-objectives' ? [
        { user_id: 'consultant', period_type: 'monthly', proposal_type: 'energia', month: '2026-10-01', target_quantity: 999 },
        { user_id: 'consultant', period_type: 'annual', proposal_type: 'energia', month: '2026-01-01', target_quantity: 5000 },
      ] : options.queryKey[0]?.startsWith('activations-') ? activations : options.queryKey[0] === 'activation-proposal-cpes' ? [{proposal_id:'proposal',consumo_anual:41330}] : options.queryKey[0] === 'activation-proposals-metadata' ? [{id:'proposal',proposal_type:'energia',negotiation_type:'angariacao'}] : [], isLoading: false }),
      useMutation: options => options,
      useQueryClient: () => ({}),
    },
    '@/integrations/supabase/client': { supabase: {} },
    '@/contexts/AuthContext': { useAuth: () => ({ organization: { id: organization } }) },
    '@/hooks/useMonthlyObjectives': { useMonthlyObjectives: date => {
      requestedMonth = date;
      return { objectives: missing ? [] : [objective], isLoading: loading };
    } },
    '@/lib/perfect2gether': { isPerfect2GetherOrg: id => id === org },
    sonner: { toast: {} },
  };
  new Function('exports', 'require', source)(exports, id => mocks[id] ?? require(id));
  const date = new Date(month + 'T12:00:00');
  return { hook: exports.useActivationObjectives(date), get requestedMonth() { return requestedMonth; }, date };
}
test('monthly activation targets use the shared energy and solar objectives, preserving annual targets', () => {
  const { hook } = run();
  assert.equal(hook.getTarget('consultant', 'monthly', 'energia'), 312.5);
  assert.equal(hook.getTarget('consultant', 'monthly', 'servicos'), 18.25);
  assert.equal(hook.getTarget('consultant', 'annual', 'energia'), 5000);
});
test('missing objectives and other consultants cannot inherit stale or another user targets', () => {
  assert.equal(run({ missing: true }).hook.getTarget('consultant', 'monthly', 'energia'), 0);
  assert.equal(run().hook.getTarget('someone-else', 'monthly', 'energia'), 0);
});
test('the selected month and updated objective reach the shared monthly source', () => {
  const result = run({ month: '2026-11-12', energy: 450 });
  assert.equal(result.requestedMonth, result.date);
  assert.equal(result.hook.getTarget('consultant', 'monthly', 'energia'), 450);
  assert.equal(run({ energy: 600 }).hook.getTarget('consultant', 'monthly', 'energia'), 600);
});
test('monthly source loading is included and other organizations retain their own activation objectives', () => {
  assert.equal(run({ loading: true }).hook.isLoading, true);
  assert.equal(run({ organization: 'another-org' }).hook.getTarget('consultant', 'monthly', 'energia'), 999);
});

test('admin-created activations count for the assigned consultant, not the admin', () => {
 const {hook}=run({activations:[{created_by:'admin',proposal_id:'proposal',proposal_type:'energia',client:{assigned_to:'consultant'},lead:{assigned_to:'other'}}]});
 assert.equal(hook.countActivations('consultant','monthly','energia'),41.33);
 assert.equal(hook.countActivations('admin','monthly','energia'),0);
 assert.equal(hook.countActivations(null,'monthly','energia'),41.33);
 assert.equal(hook.countActivations('consultant','annual','energia'),41.33);
});
