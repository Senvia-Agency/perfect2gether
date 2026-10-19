import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
const now = Date.parse('2026-10-19T11:00:00Z');
function harness(entries, enabled = true) {
  const values = [], punches = []; let cursor = 0;
  const clock = { now, userId: 'u', currentSnapshot: { entries }, phase: 'idle', isLoading: false, error: null, canRetry: false, warmup() {}, refresh: async () => {}, punch: async (action, options) => { punches.push({ action, options }); } };
  const primitive = () => null;
  const modules = { '@/hooks/useReleaseFeatures': { useReleaseFeatures: () => ({ features: { timeclock: enabled } }) }, react: { useEffect() {}, useState(initial) { const key = cursor++; if (!(key in values)) values[key] = initial; return [values[key], value => { values[key] = value; }]; } }, 'react-router-dom': { Link: primitive }, '../useTimeClock': { useTimeClock: () => clock }, '@/components/ui/popover': { Popover: primitive, PopoverContent: primitive, PopoverTrigger: primitive }, '@/components/ui/button': { Button: primitive }, '@/components/ui/input': { Input: primitive }, '@/components/ui/textarea': { Textarea: primitive } };
  function load(filename) {
    const absolute = path.resolve(filename), exports = {};
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, Intl, Date, Map, Set, require: id => modules[id] ?? (id.endsWith('.css') ? {} : id.startsWith('.') ? load(path.resolve(path.dirname(absolute), id + '.ts')) : nativeRequire(id)) });
    return exports;
  }
  const { ClockWidget } = load('src/modules/timeclock/components/ClockWidget.tsx');
  return { punches, render() { cursor = 0; return nodes(ClockWidget()); } };
}
function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); if (!node || typeof node !== 'object') return []; return [node, ...nodes(node.props?.children)]; }
function text(node) { if (Array.isArray(node)) return node.map(text).join(''); if (typeof node === 'string' || typeof node === 'number') return String(node); return node?.props ? text(node.props.children) : ''; }
const entry = (action, at) => ({ id: action, user_id: 'u', action, punched_at: `2026-10-19T${at}:00Z`, status: 'valid', note: '', flags: [], corrected: false, location_name: null, address: null });
test('working clock actions submit real pause and stop actions', async () => {
  const view = harness([entry('start', '08:00')]);
  const rendered = view.render();
  await rendered.find(node => node.props.onClick && text(node) === 'Pausa').props.onClick();
  await rendered.find(node => node.props.onClick && text(node) === ' Terminar dia').props.onClick();
  assert.deepEqual(view.punches.map(item => item.action), ['pause', 'stop']);
});
test('closed resumable day exposes resume as its sole start action', async () => {
  const view = harness([entry('start', '08:00'), entry('stop', '09:00')]);
  const rendered = view.render();
  assert.equal(rendered.filter(node => node.props.onClick && text(node).includes('Iniciar dia')).length, 0);
  const resume = rendered.find(node => node.props.onClick && text(node).trim() === 'Retomar dia');
  await resume.props.onClick();
  assert.equal(view.punches[0].action, 'resume');
});
test('manual correction requires a time and three letters before transport', async () => {
  const view = harness([]);
  view.render().find(node => node.props['aria-label'] === 'Corrigir hora do próximo registo').props.onClick();
  const rendered = view.render();
  await rendered.find(node => node.props.onClick && text(node).trim() === 'Iniciar dia').props.onClick();
  assert.equal(view.punches.length, 0);
  assert.ok(view.render().some(node => node.props.role === 'status' && text(node).includes('3 letras')));
});
test('paused panel displays current pause duration and keeps worked duration in header', () => {
  const view = harness([entry('start', '08:00'), entry('pause', '10:00')]);
  const rendered = view.render();
  assert.ok(rendered.some(node => node.type === 'strong' && text(node) === '1:00:00'));
  assert.ok(rendered.some(node => node.props['aria-label']?.includes('2:00')));
});

test('Given disabled point, when the header renders, then no point control is displayed', () => {
  assert.deepEqual(harness([], false).render(), []);
});
