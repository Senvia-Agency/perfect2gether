import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../functions/check-prospect-job/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function fixture({ visible = true, status = 'completed', valid = true, apify = 'RUNNING' } = {}) {
  let handler;
  const calls = [];
  const job = { id: 'job-1', organization_id: 'org-1', status, result: { total: 3 }, apify_run_id: 'run-1' };
  const client = service => ({
    auth: { getUser: async () => ({ data: { user: valid ? { id: 'user-1' } : null }, error: null }) },
    from(table) {
      let update;
      const query = {
        select() { return query; },
        eq() { return query; },
        update(value) { update = value; return query; },
        single: async () => {
          calls.push({ kind: 'read', service, table });
          return { data: service || visible ? job : null, error: null };
        },
        then(resolve) { calls.push({ kind: 'write', service, update }); return Promise.resolve({ error: null }).then(resolve); },
      };
      return query;
    },
  });
  vm.runInNewContext(compiled, {
    exports: {}, require: () => ({ createClient: (_url, key) => client(key === 'service') }),
    Request, Response, console: { error() {} },
    Deno: { serve: callback => { handler = callback; }, env: { get: key => ({ SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon', APIFY_API_TOKEN: 'fake-apify' })[key] } },
    fetch: async () => { calls.push({ kind: 'external' }); return Response.json({ data: { status: apify } }); },
  });
  return { calls, send: (authorization = 'Bearer user-token', method = 'POST') => handler(new Request('https://example.test', {
    method, headers: authorization ? { Authorization: authorization } : {},
    ...(method === 'OPTIONS' ? {} : { body: JSON.stringify({ jobId: 'job-1' }) }),
  })) };
}

for (const status of ['completed', 'failed', 'running']) {
  test(`invisible ${status} job returns 404 before cached data or external work`, async () => {
    const f = fixture({ visible: false, status });
    assert.equal((await f.send()).status, 404);
    assert.equal(f.calls.some(call => call.kind === 'external' || call.kind === 'write'), false);
  });
}
test('active organization member retains cached result access', async () => {
  const f = fixture();
  const response = await f.send();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result, { total: 3 });
});
test('active organization member retains running job polling', async () => {
  const f = fixture({ status: 'running' });
  assert.deepEqual(await (await f.send()).json(), { status: 'running' });
  assert.equal(f.calls.filter(call => call.kind === 'external').length, 1);
});
test('authorized job updates still use backend credentials', async () => {
  const f = fixture({ status: 'running', apify: 'FAILED' });
  assert.equal((await f.send()).status, 200);
  assert.equal(f.calls.find(call => call.kind === 'write').service, true);
});
test('invalid login fails before database reads', async () => {
  const f = fixture({ valid: false });
  assert.equal((await f.send()).status, 401);
  assert.equal(f.calls.length, 0);
});
test('anonymous requests fail before database reads', async () => {
  const f = fixture();
  assert.equal((await f.send(null)).status, 401);
  assert.equal(f.calls.length, 0);
});
test('CORS preflight remains available', async () => {
  const f = fixture();
  assert.equal((await f.send(null, 'OPTIONS')).status, 200);
});
