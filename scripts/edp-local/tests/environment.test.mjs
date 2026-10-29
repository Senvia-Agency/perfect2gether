import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const localDir = resolve(testDir, '..');
const guard = resolve(localDir, 'assert-local.ps1');
const config = resolve(localDir, 'supabase', 'config.toml');
const rootConfig = resolve(localDir, '..', '..', 'supabase', 'config.toml');
const seed = resolve(localDir, 'supabase', 'seed.sql');
const start = resolve(localDir, 'start.ps1');

function runGuard(...args) {
  return spawnSync(
    'pwsh',
    ['-NoProfile', '-NonInteractive', '-File', guard, ...args],
    { encoding: 'utf8' },
  );
}

test('accepts loopback Supabase URL and local project id', () => {
  const result = runGuard('-Url', 'http://127.0.0.1:54321', '-ProjectId', 'p2g-edp-local');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /LOCAL_ONLY_OK/);
});

test('rejects the production Supabase URL before any local command', () => {
  const result = runGuard('-Url', 'https://zycrksvkdpondqpplqce.supabase.co', '-ProjectId', 'p2g-edp-local');
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /loopback|local-only|remote/i);
});

test('rejects a production-linked project id even with a loopback URL', () => {
  const result = runGuard('-Url', 'http://127.0.0.1:54321', '-ProjectId', 'zycrksvkdpondqpplqce');
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /project|production|local/i);
});

test('rejects malformed or non-http loopback URLs', () => {
  for (const url of ['127.0.0.1:54321', 'ftp://127.0.0.1:54321', 'http://localhost.evil.test:54321']) {
    const result = runGuard('-Url', url, '-ProjectId', 'p2g-edp-local');
    assert.notEqual(result.status, 0, `accepted unsafe URL ${url}`);
  }
});

test('keeps the local Supabase config isolated and SMTP capture enabled', () => {
  assert.equal(existsSync(config), true);
  const text = readFileSync(config, 'utf8');
  const rootText = readFileSync(rootConfig, 'utf8');
  assert.match(text, /project_id\s*=\s*"p2g-edp-local"/);
  assert.match(rootText, /project_id\s*=\s*"zycrksvkdpondqpplqce"/);
  assert.notEqual(text, rootText);
  assert.match(text, /\[inbucket\][\s\S]*enabled\s*=\s*true/);
  assert.match(text, /\[auth\.email\.smtp\][\s\S]*host\s*=\s*"inbucket"/);
  assert.doesNotMatch(text, /zycrksvkdpondqpplqce|supabase\.co|brevo/i);
});

test('seeds native-login users for both organizations without production credentials', () => {
  const text = readFileSync(seed, 'utf8');
  for (const email of ['admin@p2g.local', 'bo@p2g.local', 'comercial.a@p2g.local', 'comercial.b@p2g.local', 'comercial.c@p2g.local']) {
    assert.match(text, new RegExp(email.replace('.', '\\.'), 'i'));
  }
  assert.match(text, /96a3950e-31be-4c6d-abed-b82968c0d7e9/);
  assert.match(text, /p2g-local-org-a/);
  assert.match(text, /p2g-local-org-b/);
  assert.match(text, /organization_profiles/);
  assert.match(text, /'Back Office'/);
  assert.match(text, /'Comercial'/);
  assert.match(text, /'00000000-0000-0000-0000-000000002002', 'viewer'/);
  assert.match(text, /'00000000-0000-0000-0000-000000002005', 'salesperson'/);
  assert.doesNotMatch(text, /zycrksvkdpondqpplqce|SUPABASE_SERVICE_ROLE_KEY|BREVO_API_KEY/i);
});

test('startup is pinned to the local workdir and never invokes remote mutation commands', () => {
  const text = readFileSync(start, 'utf8');
  assert.match(text, /Ensure-LocalLayout|LocalRoot/);
  assert.match(text, /Arguments\s+@\('start'\)/);
  assert.doesNotMatch(text, /db\s+push|functions\s+deploy|supabase\s+link|vercel\s+--prod/i);
});
