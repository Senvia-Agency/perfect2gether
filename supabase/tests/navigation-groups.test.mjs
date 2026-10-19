import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function run({ admin = true, denied = [], disabled = [], locked = [], systems = ['p2g'], messages = true } = {}) {
  const exports = {};
  const mocks = {
    './useReleaseFeatures': { useReleaseFeatures: () => ({ features: { messages } }) },
    '@/modules/messages/useUnreadMessages': { useUnreadMessages: () => 7 },
    '@/contexts/AuthContext': { useAuth: () => ({ isSuperAdmin: false }) },
    '@/hooks/useModules': { useModules: () => ({ modules: new Proxy({}, { get: (_, key) => !disabled.includes(key) }) }) },
    '@/hooks/usePermissions': { usePermissions: () => ({ isAdmin: admin, canViewModule: key => !denied.includes(key), systems }) },
    '@/hooks/useSubscription': { useSubscription: () => ({ isModuleLocked: key => locked.includes(key) }) },
  };
  const source = ts.transpileModule(readFileSync('src/hooks/useNavItems.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const load = path => {
    if (path === '@/lib/navigation-groups') {
      const groupExports = {};
      new Function('exports', ts.transpileModule(readFileSync('src/lib/navigation-groups.ts','utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText)(groupExports);
      return groupExports;
    }
    return mocks[path] ?? require(path);
  };
  new Function('exports','require',source)(exports,load);
  return exports.useNavItems();
}
const summarize = sections => sections?.map(section => [section.label,section.items.map(item => item.to)]);
test('authorized routes are grouped in the approved order', () => {
  const nav = run();
  assert.deepEqual(summarize(nav.primarySections), [
    ['Geral',['/dashboard','/messages']],
    ['Comercial',['/leads','/clients','/proposals','/sales']],
    ['Operação',['/financeiro','/calendar','/rh']],
  ]);
  assert.deepEqual(summarize(nav.secondarySections), [
    ['Crescimento',['/marketing','/prospects','/ecommerce']],
    ['Administração',['/gestao','/settings']],
  ]);
  assert.deepEqual(nav.mobileShortcuts.map(item => item.to), ['/dashboard','/messages','/leads']);
});
test('grouping preserves existing permission, module, badge and subscription results', () => {
  const nav = run({admin:false, denied:['proposals','gestao'], disabled:['marketing'], locked:['ecommerce']});
  const grouped = [...nav.primarySections,...nav.secondarySections].flatMap(section => section.items);
  assert.deepEqual(grouped.map(item => item.to).sort(), nav.items.map(item => item.to).sort());
  assert.ok(!grouped.some(item => ['/settings','/gestao','/proposals','/marketing'].includes(item.to)));
  assert.equal(grouped.find(item => item.to === '/messages').unread,7);
  assert.equal(grouped.find(item => item.to === '/ecommerce').locked,true);
});
test('empty secondary groups disappear and Total Link keeps its portal-only navigation', () => {
  assert.deepEqual(run({admin:false,denied:['gestao'],disabled:['marketing','prospects','ecommerce']}).secondarySections,[]);
  const portal = run({systems:['total_link']});
  assert.deepEqual(summarize(portal.primarySections), [['Geral',['/portal-total-link']]]);
  assert.deepEqual(portal.secondarySections,[]);
  assert.deepEqual(portal.mobileShortcuts,[]);
});

test('Given disabled messages, when navigation loads, then the inbox is absent', () => {
  const nav = run({ messages: false });
  assert.equal(nav.items.some(item => item.to === '/messages'), false);
  assert.equal(nav.items.some(item => item.to === '/rh'), true);
});
