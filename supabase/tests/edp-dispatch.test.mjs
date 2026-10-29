import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadTypeScript(path) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', output)(require, exports);
  return exports;
}

const local = loadTypeScript('supabase/functions/_shared/edp-local.ts');
const documents = loadTypeScript('supabase/functions/_shared/edp-documents.ts');
const brevo = loadTypeScript('supabase/functions/_shared/edp-brevo.ts');

test('EDP entrypoints resolve the pinned npm client without JSR metadata', () => {
  const entrypoints = [
    'supabase/functions/edp-dispatch/index.ts',
    'supabase/functions/edp-documents/index.ts',
  ];
  for (const entrypoint of entrypoints) {
    const source = fs.readFileSync(entrypoint, 'utf8');
    assert.equal(source.includes('jsr:'), false);
    assert.match(source, /from 'npm:@supabase\/supabase-js@2\.49\.8'/);
  }
});

test('capture transport accepts only local HTTP endpoints and fixes the send path', () => {
  assert.equal(local.parseLocalCaptureUrl('http://127.0.0.1:8025').href, 'http://127.0.0.1:8025/api/v1/send');
  assert.equal(local.parseLocalCaptureUrl('http://localhost:8025/').href, 'http://localhost:8025/api/v1/send');
  assert.throws(() => local.parseLocalCaptureUrl('https://api.brevo.com/v3/smtp/email'), /local/i);
  assert.throws(() => local.parseLocalCaptureUrl('http://example.com:8025'), /local/i);
  assert.throws(() => local.parseLocalCaptureUrl('file:///tmp/mail'), /http/i);
});

test('Mailpit payload contains all and only the frozen manifest attachments', () => {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const payload = local.buildMailpitPayload({
    from: { email: 'local-sender@example.test', name: 'P2G local' },
    to: ['edp@example.test'],
    cc: ['bo@example.test'],
    subject: 'EDP SF-1',
    html: '<p>Teste</p>',
    attachments: [{ filename: 'contrato.pdf', contentType: 'application/pdf', bytes }],
  });
  assert.deepEqual(payload.To, [{ Email: 'edp@example.test' }]);
  assert.deepEqual(payload.Cc, [{ Email: 'bo@example.test' }]);
  assert.deepEqual(payload.Attachments, [{
    Filename: 'contrato.pdf',
    ContentType: 'application/pdf',
    Content: 'JVBERi0=',
  }]);
  assert.equal(local.estimateMailpitPayloadBytes(payload) > bytes.length, true);
});

test('document validation checks declared MIME, magic bytes and size before upload', () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
  assert.equal(documents.validateEdpDocument(pdf, 'application/pdf', 'contrato.pdf').mimeType, 'application/pdf');
  assert.throws(() => documents.validateEdpDocument(pdf, 'image/png', 'contrato.png'), /conteúdo/i);
  assert.throws(
    () => documents.validateEdpDocument(new Uint8Array(10 * 1024 * 1024 + 1), 'application/pdf', 'grande.pdf'),
    /10 MiB/,
  );
  assert.throws(() => documents.validateEdpDocument(new Uint8Array([1, 2, 3]), 'text/plain', 'x.txt'), /PDF|JPEG|PNG/);
});

test('readable PDF dates are suggestions while scans remain manual', () => {
  const readable = new TextEncoder().encode('%PDF-1.7 Validade: 2030-12-31');
  assert.equal(documents.suggestEdpValidityDate(readable, 'application/pdf', '2026-10-28'), '2030-12-31');
  const scan = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
  assert.equal(documents.suggestEdpValidityDate(scan, 'image/jpeg', '2026-10-28'), null);
});

test('storage paths are generated from UUIDs and never from caller filenames', () => {
  const path = documents.buildEdpStoragePath({
    organizationId: '11111111-1111-4111-8111-111111111111',
    clientId: '22222222-2222-4222-8222-222222222222',
    documentId: '33333333-3333-4333-8333-333333333333',
    versionId: '44444444-4444-4444-8444-444444444444',
    mimeType: 'image/png',
  });
  assert.equal(path, '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.png');
  assert.equal(path.includes('..'), false);
});

test('Brevo payload keeps frozen recipients, CC and exact attachment bytes', () => {
  const payload = brevo.buildBrevoPayload({
    from: { email: 'sender@example.test', name: 'P2G' },
    to: ['edp@example.test'], cc: ['bo@example.test'], subject: 'EDP SF-1', html: '<p>Cliente</p>',
    attachments: [{ filename: 'contrato.pdf', contentType: 'application/pdf', bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) }],
    dispatchId: '70000000-0000-4000-8000-000000000001',
  });
  assert.deepEqual(payload.to, [{ email: 'edp@example.test' }]);
  assert.deepEqual(payload.cc, [{ email: 'bo@example.test' }]);
  assert.deepEqual(payload.attachment, [{ name: 'contrato.pdf', content: 'JVBERg==' }]);
  assert.equal(payload.headers['X-P2G-EDP-Dispatch'], '70000000-0000-4000-8000-000000000001');
});

test('real sending stays disabled until both server and organization gates are enabled', () => {
  assert.throws(() => brevo.assertEdpSendEnabled(undefined, true), /servidor/i);
  assert.throws(() => brevo.assertEdpSendEnabled('true', false), /organização/i);
  assert.doesNotThrow(() => brevo.assertEdpSendEnabled('true', true));
});

test('Brevo 5xx response is uncertain so retry cannot blindly duplicate delivery', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"message":"temporarily unavailable"}', { status: 503 });
  try {
    await assert.rejects(
      brevo.postBrevoMessage('test-key', {
        sender: { email: 'sender@example.test', name: 'P2G' },
        to: [{ email: 'edp@example.test' }], cc: [], subject: 'EDP SF-1', htmlContent: '<p>EDP</p>',
        attachment: [], headers: { 'X-P2G-EDP-Dispatch': '70000000-0000-4000-8000-000000000001' },
      }),
      (error) => error?.kind === 'uncertain',
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('local capture 5xx response is uncertain for the same crash-safe retry rule', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"message":"temporarily unavailable"}', { status: 503 });
  try {
    await assert.rejects(
      local.postToLocalCapture(new URL('http://127.0.0.1:8025/api/v1/send'), {
        From: { Email: 'sender@example.test' }, To: [{ Email: 'edp@example.test' }], Cc: [], Subject: 'EDP',
        HTML: '<p>EDP</p>', Text: 'EDP', Attachments: [], Headers: {},
      }),
      (error) => error?.kind === 'uncertain',
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
