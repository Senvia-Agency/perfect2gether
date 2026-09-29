import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../functions/sync-campaign-sends/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function handlerFor(member) {
  let handler;
  const tables = [];
  const client = {
    auth: { async getUser() { return { data: { user: { id: 'caller' } }, error: null }; } },
    from(table) {
      tables.push(table);
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() {
          return { data: table === 'organization_members' && member ? { user_id: 'caller' } : null, error: null };
        },
        async single() { return { data: null, error: null }; },
      };
      return query;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    Request,
    Response,
    console,
    Deno: { env: { get: () => 'test-key' } },
    require(specifier) {
      if (specifier.includes('/http/server.ts')) return { serve: callback => { handler = callback; } };
      if (specifier.includes('supabase-js')) return { createClient: () => client };
      if (specifier.includes('p2g-mfa-guard')) return { p2gMfaGate: async () => null };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  return {
    tables,
    send: () => handler(new Request('https://example.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer caller-jwt' },
      body: JSON.stringify({ campaignId: 'campaign', organizationId: 'p2g' }),
    })),
  };
}

test('campaign sync denies a caller outside the target organization before campaign access', async () => {
  const app = handlerFor(false);
  assert.equal((await app.send()).status, 403);
  assert.deepEqual(app.tables, ['organization_members', 'user_roles']);
});

test('campaign sync reaches the campaign only for an active member', async () => {
  const app = handlerFor(true);
  assert.equal((await app.send()).status, 404);
  assert.deepEqual(app.tables, ['organization_members', 'email_campaigns']);
});
