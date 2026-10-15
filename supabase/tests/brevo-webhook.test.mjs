import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);

function webhook({token = 'dedicated-token', databaseError = null} = {}) {
  let serve;
  const updates = [];
  const client = {from() {
    const query = {update: value => {updates.push(value); return query;}, eq: () => query,
      select: () => query, maybeSingle: async () => ({data: {sent_at: new Date().toISOString()}}),
      then: resolve => Promise.resolve({error: databaseError}).then(resolve)};
    return query;
  }};
  const output = ts.transpileModule(fs.readFileSync('supabase/functions/brevo-webhook/index.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(output, {exports: {}, require: specifier => specifier.includes('/http/server')
    ? {serve: fn => {serve = fn;}} : specifier.includes('supabase-js') ? {createClient: () => client} : require('zod'),
    Deno: {env: {get: name => name === 'BREVO_WEBHOOK_TOKEN' ? token : 'configured'}},
    Response, Request, Headers, crypto, TextEncoder, Date, console: {log() {}, error() {}}});
  return {updates, run: (event, authorization = 'Bearer dedicated-token') => serve(new Request('https://example.test', {
    method: 'POST', headers: {'Content-Type': 'application/json', ...(authorization ? {Authorization: authorization} : {})},
    body: JSON.stringify({'message-id': 'qa-message', event}),
  }))};
}

test('webhook rejects missing, incorrect and unconfigured dedicated tokens before updating data', async () => {
  for (const authorization of ['', 'Bearer wrong-token']) {
    const app = webhook();
    assert.equal((await app.run('delivered', authorization)).status, 401);
    assert.equal(app.updates.length, 0);
  }
  const app = webhook({token: ''});
  assert.equal((await app.run('delivered')).status, 503);
  assert.equal(app.updates.length, 0);
});

test('authenticated Brevo event aliases update tracking, including genuine immediate opens', async () => {
  for (const [event, field, value] of [['delivered', 'status', 'delivered'], ['uniqueOpened', 'opened_at'],
    ['opened', 'opened_at'], ['clicks', 'clicked_at'], ['hardBounce', 'status', 'bounced'], ['softBounce', 'status', 'bounced']]) {
    const app = webhook();
    assert.equal((await app.run(event)).status, 200);
    assert.equal(app.updates.length, 1);
    if (value) assert.equal(app.updates[0][field], value);
    else assert.ok(app.updates[0][field]);
  }
});

test('database failures produce a retryable response instead of acknowledging lost events', async () => {
  const app = webhook({databaseError: {message: 'unavailable'}});
  assert.equal((await app.run('delivered')).status, 500);
});
