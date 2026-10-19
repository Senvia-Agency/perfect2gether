import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

test('forward retry reuses message and copied file after a lost send response', async () => {
  const requests = [], objects = new Map(); let copied = 0;
  const storage = { copy: async (from, path) => { copied++; objects.set(path.split('/').at(-1), { name: path.split('/').at(-1), metadata: { size: 3 } }); return { error: null }; }, list: async () => ({ data: [...objects.values()], error: null }) };
  const supabase = { storage: { from: () => storage }, rpc: async (_name, { payload }) => { requests.push(payload); if (requests.length === 1) return { error: { code: 'network', message: 'lost response' } }; return { data: payload, error: null }; } };
  const schema = z.object({}).passthrough(); const exports = {};
  const compiled = ts.transpileModule(readFileSync('src/modules/messages/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, crypto: { randomUUID }, require(name) { if (name === 'zod') return { z }; if (name.includes('supabase/client')) return { supabase }; if (name === './types') return { messageSchema: schema }; return {}; } });
  const message = { body: 'caption', attachments: [{ id: randomUUID(), path: 'source', name: 'demo.zip', mime: 'application/zip', size: 3 }] };
  const attempt = exports.createForwardAttempt?.(message);
  await assert.rejects(exports.forwardMessage(message, 'target', 'org', 'user', attempt), /lost response/);
  await exports.forwardMessage(message, 'target', 'org', 'user', attempt);
  assert.equal(requests[0].id, requests[1].id);
  assert.equal(requests[0].attachments[0].path, requests[1].attachments[0].path);
  assert.equal(copied, 1);
});
