import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function harness({ around = null, hidden = false, send } = {}) {
  const states = [[{ id: 'message', created_at: '2026-10-19T10:00:00Z' }]], refs = [], effects = [], calls = [], listeners = new Map();
  let si = 0, ri = 0;
  const document = { visibilityState: hidden ? 'hidden' : 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), getElementById: () => null };
  const params = new URLSearchParams({ conversation: 'first', ...(around ? { message: around } : {}) });
  class MessagingError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const api = { MessagingError, chatAction: async (...args) => calls.push(args), messagesApi: { send: send ?? (async input => input), history: async () => states[0] }, forwardMessage: async () => {} };
  const react = { useState(value) { const index = si++; if (!(index in states)) states[index] = value; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; }, useRef(current) { const index = ri++; return refs[index] ??= { current }; }, useCallback: fn => fn, useEffect: fn => effects.push(fn) };
  const source = readFileSync('src/modules/messages/useMessages.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(name) {
    if (name === 'react') return react;
    if (name.includes('react-query')) return { useQuery: options => ({ data: options.queryKey[0] === 'messages-saved' ? [] : { max_file_bytes: 100, conversations: [] } }), useQueryClient: () => ({ invalidateQueries: async () => {} }) };
    if (name.includes('react-router')) return { useSearchParams: () => [params, () => {}] };
    if (name.includes('AuthContext')) return { useAuth: () => ({ user: { id: 'user' }, organization: { id: 'org' } }) };
    if (name === './api') return api;
    if (name === './uploads') return { uploadAttachment: async () => ({}) };
    return {};
  }, document, crypto: { randomUUID }, window: { setInterval, clearInterval }, Date });
  function render() { si = 0; ri = 0; effects.length = 0; return exports.useMessages(); }
  return { render, effects, calls, listeners, document };
}

test('busy send rejects rather than reporting a second draft as delivered', async () => {
  let finish;
  const fixture = harness({ send: input => new Promise(resolve => { finish = () => resolve(input); }) });
  const controller = fixture.render();
  const pending = controller.send('first draft', [], null, () => {});
  await assert.rejects(controller.send('second draft', [], null, () => {}), /envio|enviar/i);
  finish(); await pending;
});

test('historical jump does not mark unseen latest messages read', async () => {
  const fixture = harness({ around: 'old-message' }); fixture.render();
  const effect = fixture.effects.find(fn => fn.toString().includes('visibilitychange'));
  effect(); await Promise.resolve();
  assert.equal(fixture.calls.filter(([action]) => action === 'read').length, 0);
});

test('hidden conversation registers reading when it becomes visible', async () => {
  const fixture = harness({ hidden: true }); fixture.render();
  const effect = fixture.effects.find(fn => fn.toString().includes('visibilitychange'));
  effect();
  assert.equal(fixture.calls.length, 0);
  fixture.document.visibilityState = 'visible';
  fixture.listeners.get('visibilitychange')?.(); await Promise.resolve();
  assert.equal(fixture.calls.filter(([action]) => action === 'read').length, 1);
});
