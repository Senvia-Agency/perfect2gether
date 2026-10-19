import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { z } from 'zod';

function fixture({ existing = [], fail = false, hold = false, tusUpload } = {}) {
  const calls = [];
  const exports = {};
  class Upload {
    constructor(file, options) { this.options = options; calls.push(this); }
    async findPreviousUploads() { return []; }
    resumeFromPreviousUpload(previous) { this.previous = previous; }
    async abort() { this.aborted = true; }
    start() { if (!hold) queueMicrotask(() => fail ? this.options.onError(new Error('network')) : this.options.onSuccess()); }
  }
  let token = 0;
  const supabase = { auth: { async getSession() { return { data: { session: { access_token: `token-${++token}` } }, error: null }; } }, storage: { from(bucket) { calls.push(bucket); return { async list() { return { data: existing, error: null }; } }; } } };
  const source = readFileSync(new URL('../../src/modules/messages/uploads.ts', import.meta.url), 'utf8').replaceAll('import.meta.env.VITE_SUPABASE_URL', "'https://project.supabase.co'");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => name === 'tus-js-client' ? { Upload: tusUpload ?? Upload } : name === 'zod' ? { z } : { supabase }, URL, DOMException, Error, File, console, queueMicrotask });
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
  const input = { org: ids[0], conversation: ids[1], user: ids[2], message: ids[3], id: ids[4], file: new File(['abc'], '../demo.zip', { type: 'application/x-zip-compressed' }), maxBytes: 3, onProgress() {} };
  return { api: exports, input, calls, Upload };
}

test('formats boundaries and chooses direct hosted or unchanged local storage endpoint', () => {
  const { api } = fixture();
  assert.equal(api.formatBytes(0), '0 B');
  assert.equal(api.formatBytes(1024), '1 KB');
  assert.equal(api.getStorageEndpoint('https://abc.supabase.co'), 'https://abc.storage.supabase.co/storage/v1/upload/resumable');
  assert.equal(api.getStorageEndpoint('http://127.0.0.1:54321'), 'http://127.0.0.1:54321/storage/v1/upload/resumable');
});
test('rejects empty, excessive and unsafe path inputs before accessing storage', async () => {
  const { api, input, calls } = fixture();
  await assert.rejects(api.uploadAttachment({ ...input, file: new File([], 'empty') }));
  await assert.rejects(api.uploadAttachment({ ...input, maxBytes: 2 }));
  await assert.rejects(api.uploadAttachment({ ...input, org: '../other' }));
  assert.equal(calls.length, 0);
});
test('uploads ZIP using scoped identity, chunks, current credentials and safe presentation name', async () => {
  const { api, input, calls, Upload } = fixture();
  const result = await api.uploadAttachment(input);
  const upload = calls.find(call => call instanceof Upload);
  assert.equal(result.path, [input.org, input.conversation, input.user, input.message, input.id].join('/'));
  assert.equal(result.name, 'demo.zip');
  assert.equal(upload.options.chunkSize, 6 * 1024 * 1024);
  assert.equal(upload.options.headers?.['x-upsert'], undefined);
  assert.ok((await upload.options.fingerprint()).includes(result.path));
  const headers = [];
  await upload.options.onBeforeRequest({ setHeader: (key, value) => headers.push(value) });
  await upload.options.onBeforeRequest({ setHeader: (key, value) => headers.push(value) });
  assert.notEqual(headers[0], headers[1]);
});
test('reuses completed exact object only when its size matches', async () => {
  const { api, input, calls, Upload } = fixture({ existing: [{ name: '55555555-5555-4555-8555-555555555555', metadata: { size: 3 } }] });
  assert.equal((await api.uploadAttachment(input)).size, 3);
  assert.equal(calls.some(call => call instanceof Upload), false);
});
test('abort settles outstanding upload and terminates transfer', async () => {
  const { api, input, calls, Upload } = fixture({ hold: true });
  const controller = new AbortController();
  const promise = api.uploadAttachment({ ...input, signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(calls.find(call => call instanceof Upload).aborted, true);
});

test('refuses to reuse a mismatched completed object', async () => {
  const { api, input } = fixture({ existing: [{ name: '55555555-5555-4555-8555-555555555555', metadata: { size: 99 } }] });
  await assert.rejects(api.uploadAttachment(input), /ficheiro diferente/);
});

function voiceFixture({ pendingPermission = false } = {}) {
  const states = []; const effects = []; const timers = new Set();
  let elapsed = 0; let stoppedTracks = 0; let grant;
  const stream = { getTracks: () => [{ stop() { stoppedTracks++; } }] };
  let instance;
  class Recorder {
    static isTypeSupported(type) { return type === 'audio/mp4'; }
    constructor(media, options) { this.state = 'inactive'; this.mimeType = options.mimeType; instance = this; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) }); this.onstop?.(); }
  }
  const react = {
    useState(value) { const index = states.length; states.push(value); return [value, next => { states[index] = next; }]; },
    useRef: current => ({ current }), useCallback: fn => fn, useEffect: fn => effects.push(fn()),
  };
  const exports = {};
  const source = readFileSync(new URL('../../src/modules/messages/useVoiceRecorder.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: () => react, navigator: { mediaDevices: { getUserMedia: () => pendingPermission ? new Promise(resolve => { grant = () => resolve(stream); }) : Promise.resolve(stream) } }, MediaRecorder: Recorder, performance: { now: () => elapsed }, setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn), DOMException, File, Date });
  const hook = exports.useVoiceRecorder();
  return { hook, states, timers, advance: ms => { elapsed += ms; for (const fn of timers) fn(); }, unmount: () => effects.forEach(fn => fn?.()), tracks: () => stoppedTracks, grant: () => grant(), instance: () => instance };
}

test('voice records supported MP4 in memory and releases tracks on stop', async () => {
  const fixture = voiceFixture();
  await fixture.hook.start();
  fixture.advance(1200);
  fixture.hook.stop();
  assert.equal(fixture.states[3].type, 'audio/mp4');
  assert.match(fixture.states[3].name, /\.m4a$/);
  assert.equal(fixture.tracks(), 1);
  assert.equal(fixture.timers.size, 0);
});
test('voice discards too-short recording and caps a recording at five minutes', async () => {
  const fixture = voiceFixture();
  await fixture.hook.start(); fixture.advance(799); fixture.hook.stop();
  assert.equal(fixture.states[3], null);
  await fixture.hook.start(); fixture.advance(300000);
  assert.equal(fixture.instance().state, 'inactive');
  assert.equal(fixture.states[1], 300);
  assert.equal(fixture.timers.size, 0);
});
test('voice unmount during pending permission releases eventual stream without starting recorder', async () => {
  const fixture = voiceFixture({ pendingPermission: true });
  const started = fixture.hook.start();
  fixture.unmount(); fixture.grant(); await started;
  assert.equal(fixture.tracks(), 1);
  assert.equal(fixture.instance(), undefined);
  assert.equal(fixture.timers.size, 0);
});


test('real TUS client transmits bytes and authorization through an HTTP server', async () => {
  const { createServer } = await import('node:http');
  const { Upload: RealUpload } = await import('tus-js-client');
  const requests = [];
  const server = createServer(async (request, response) => {
    const buffers = [];
    for await (const chunk of request) buffers.push(chunk);
    const body = Buffer.concat(buffers);
    requests.push({ method: request.method, headers: request.headers, body });
    response.writeHead(201, { 'Tus-Resumable': '1.0.0', Location: '/uploads/1', 'Upload-Offset': String(body.length) });
    response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    class WireUpload extends RealUpload {
      constructor(file, options) {
        // The package uses Buffer in Node and File in the browser; preserve the real TUS wire adapter.
        super(Buffer.from('abc'), { ...options, retryDelays: [], storeFingerprintForResuming: false, endpoint: `http://127.0.0.1:${address.port}/uploads` });
      }
    }
    const { api, input } = fixture({ tusUpload: WireUpload });
    const result = await api.uploadAttachment(input);
    assert.equal(result.size, 3);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].body.toString(), 'abc');
    assert.match(requests[0].headers.authorization, /^Bearer token-/);
    assert.equal(requests[0].headers['x-upsert'], undefined);
    assert.ok(requests[0].headers['upload-metadata'].includes(Buffer.from(result.path).toString('base64')));
  } finally { await new Promise(resolve => server.close(resolve)); }
});


test('upload and voice modules typecheck with strict boundaries', () => {
  const root = new URL('../../', import.meta.url);
  const configPath = new URL('tsconfig.app.json', root);
  const config = ts.readConfigFile(fileURLToPath(configPath), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(root));
  const paths = ['src/modules/messages/uploads.ts', 'src/modules/messages/useVoiceRecorder.ts', 'src/vite-env.d.ts'].map(path => decodeURIComponent(new URL(path, root).pathname.replace(/^\/(\w:)/, '$1')));
  const program = ts.createProgram(paths, { ...parsed.options, strict: true, noUncheckedIndexedAccess: true });
  const errors = ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: ts.sys.getCurrentDirectory, getCanonicalFileName: path => path, getNewLine: () => '\n' }));
});


test('normalizes recorded Opus MIME for upload metadata and completed retries', async () => {
  const fresh = fixture();
  const file = new File(['abc'], 'voice.webm', { type: 'audio/webm;codecs=opus' });
  const attachment = await fresh.api.uploadAttachment({ ...fresh.input, file });
  assert.equal(attachment.mime, 'audio/webm');
  assert.equal(fresh.calls.find(call => call instanceof fresh.Upload).options.metadata.contentType, 'audio/webm');
  const retry = fixture({ existing: [{ name: fresh.input.id, metadata: { size: 3, mimetype: 'audio/webm' } }] });
  assert.equal((await retry.api.uploadAttachment({ ...retry.input, file })).mime, 'audio/webm');
});
