import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderPanel(salesResult) {
  const exports = {};
  const source = readFileSync('src/components/dashboard/TeamPerformanceTable.tsx', 'utf8');
  const compiled = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  });
  const stub = ({ children }) => React.createElement('div', null, children);
  const mocks = {
    react: { ...React, useMemo: (fn) => fn(), useRef: () => ({ current: null }) },
    '@tanstack/react-query': { useQuery: ({ queryKey }) => queryKey[0] === 'team-perf-sales'
      ? salesResult : { data: undefined, isLoading: false } },
    '@/contexts/AuthContext': { useAuth: () => ({ user: { id: 'director' }, profile: { full_name: 'Diretor' }, organization: { id: 'org', niche: 'telecom' } }) },
    '@/hooks/useProposals': { useProposals: () => ({ data: [], isLoading: false }) },
    '@/hooks/useTeam': { useTeamMembers: () => ({ data: [] }) },
    '@/hooks/useTeamFilter': { useTeamFilter: () => ({ canFilterByTeam: true, dataScope: 'all', teamMemberIds: [] }) },
    '@/stores/useDashboardPeriod': { useDashboardPeriod: () => ({ selectedMonth: new Date(2026, 10, 1) }) },
    '@/integrations/supabase/client': { supabase: {} },
    './PrintCardButton': { PrintCardButton: stub },
    'lucide-react': { Users: stub },
    '@/components/ui/card': { Card: stub, CardContent: stub, CardHeader: stub, CardTitle: stub },
    '@/components/ui/skeleton': { Skeleton: stub },
    '@/components/ui/table': Object.fromEntries(['Table', 'TableBody', 'TableCell', 'TableHead', 'TableHeader', 'TableRow'].map(key => [key, stub])),
  };
  const load = (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  new Function('require', 'exports', compiled)(load, exports);
  return renderToStaticMarkup(exports.TeamPerformanceTable());
}

test('team dashboard renders while sales have not loaded yet', () => {
  assert.match(renderPanel({ data: undefined, isLoading: true }), /Performance da Equipa/);
});

test('team dashboard does not crash if a sales query has no data after failure', () => {
  assert.match(renderPanel({ data: undefined, isLoading: false, isError: true }), /Performance da Equipa/);
});

test('team dashboard still renders when sales resolve to an empty list', () => {
  assert.match(renderPanel({ data: [], isLoading: false }), /Diretor/);
});
