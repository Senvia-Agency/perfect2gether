import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('internal worker accepts only its private automation credential', () => {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync('supabase/functions/_shared/internal-automation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{exports,Response,Deno:{env:{get:key=>key==='P2G_AUTOMATION_TOKEN'?'synthetic-automation':key==='SUPABASE_SERVICE_ROLE_KEY'?'synthetic-service':undefined}}});
  const gate = headers => exports.internalAutomationGate(new Request('http://localhost',{headers}));
  assert.equal(gate({}).status,401);
  assert.equal(gate({'x-p2g-automation-token':'wrong'}).status,401);
  assert.equal(gate({'Authorization':'Bearer sb_publishable_not-a-jwt'}).status,401);
  assert.equal(gate({'x-p2g-automation-token':'synthetic-automation'}),null);
  assert.equal(gate({'Authorization':'Bearer synthetic-service'}),null);
});

test('automation worker uses its internal credential gate instead of incompatible gateway JWT validation', () => {
  const config=readFileSync('supabase/config.toml','utf8');
  assert.match(config,/\[functions\.process-chat-jobs\]\s*verify_jwt\s*=\s*false/);
  assert.match(readFileSync('supabase/functions/process-chat-jobs/index.ts','utf8'),/const denied = internalAutomationGate\(req\); if \(denied\) return denied/);
});

test('local messages runner disables automatic hosted push subscription synchronization', () => {
  assert.ok(readFileSync('src/components/auth/ProtectedLayoutRoute.tsx','utf8').includes('!import.meta.env.DEV && <PushSubscriptionRefresh'));
});
