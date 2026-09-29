import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../functions/_shared/p2g-mfa-guard.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function gate(result) {
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: () => ({ createClient: () => ({ rpc: async () => result }) }),
    Request,
    Response,
    Deno: { env: { get: name => ({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    })[name] } },
  });
  return module.exports.p2gMfaGate;
}

for (const [label, token, result, status] of [
  ['verified session', 'user-jwt', { data: true, error: null }, null],
  ['unverified P2G session', 'user-jwt', { data: false, error: null }, 403],
  ['database MFA denial', 'user-jwt', { data: null, error: { code: '42501' } }, 403],
  ['unknown database failure', 'user-jwt', { data: null, error: { code: '500' } }, 503],
  ['missing user token', null, { data: false, error: null }, 401],
  ['public anon key', 'anon-key', { data: true, error: null }, 401],
  ['service request', 'service-key', { data: false, error: null }, null],
]) {
  test(`Edge MFA gate handles ${label}`, async () => {
    const request = new Request('https://example.test', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const response = await gate(result)(request, { 'Access-Control-Allow-Origin': '*' });
    assert.equal(response?.status ?? null, status);
  });
}
