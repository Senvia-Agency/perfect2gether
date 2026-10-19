import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(filename) {
  const absolute = path.resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute);
  const exports = {};
  cache.set(absolute, exports);
  const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Intl, Date, Map, Set, require: id => id.startsWith('.') ? load(path.resolve(path.dirname(absolute), id + '.ts')) : nativeRequire(id) });
  return exports;
}
const report = load('src/modules/timeclock/exports/monthly.ts');
const pdf = load('src/modules/timeclock/exports/pdf.ts');
const now = Date.parse('2026-10-20T19:00:00Z');
const entry = (user, action, time, extra = {}) => ({ id: user + time, user_id: user, action, punched_at: `2026-10-19T${time}:00Z`, status: 'valid', flags: [], note: '', corrected: false, ...extra });
const snapshot = { timezone: 'Europe/Lisbon', holidays: [{ date: '2026-10-05', name: 'Implantação da República' }], people: [{ id: 'a', name: 'Ana Silva', role: 'Operações', is_active: true }, { id: 'b', name: 'Bruno Inativo', role: 'Comercial', is_active: false }, { id: 'c', name: 'Sem registos', role: '', is_active: false }], entries: [entry('a', 'start', '08:00'), entry('a', 'pause', '12:00'), entry('a', 'resume', '13:00', { corrected: true, status: 'pending', note: '=HYPERLINK("malicious")' }), entry('a', 'stop', '17:00'), entry('b', 'start', '09:00'), entry('b', 'stop', '10:00')] };
test('monthly reports include departed people with records and keep per-person work isolated', () => {
  const results = report.reportsFor(snapshot, '2026-10', undefined, now);
  assert.equal(results.length, 2);
  assert.equal(results[0].summary.workSeconds, 8 * 3600);
  assert.equal(results[1].summary.workSeconds, 3600);
  assert.equal(report.reportsFor(snapshot, '2026-10', 'b', now).length, 1);
});
test('CSV preserves quotes, neutralizes spreadsheet formulas and includes provisional/manual status', () => {
  const csv = report.monthlyCsv(report.reportsFor(snapshot, '2026-10', 'a', now));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=HYPERLINK("));
  assert.ok(csv.includes('""malicious""'));
  assert.ok(csv.includes('"Sim";"Não";"Sim"'));
  assert.ok(csv.includes('"8:00"'));
  assert.ok(csv.includes('Implantação da República'));
});
test('real A4 PDF contains one report per person, total, identity, signatures and page numbering', async () => {
  const document = await pdf.buildMonthlyPdf(report.reportsFor(snapshot, '2026-10', undefined, now), '2026-10', { name: 'Empresa de Teste', nif: '500000000', logo: null });
  assert.equal(document.getNumberOfPages(), 2);
  assert.equal(Math.round(document.internal.pageSize.getWidth()), 210);
  assert.equal(Math.round(document.internal.pageSize.getHeight()), 297);
  const bytes = document.output('arraybuffer');
  const content = Buffer.from(bytes).toString('latin1');
  assert.ok(content.startsWith('%PDF-1.3'));
  assert.ok(content.includes('500000000'));
  assert.ok(content.includes('Ana Silva'));
  assert.ok(content.includes('Bruno Inativo'));
  assert.ok(content.includes('Total: 8:00'));
  assert.ok(content.includes('Assinatura do colaborador'));
  const artifact = process.env.CLOCK_PDF_ARTIFACT ?? path.join(os.tmpdir(), 'p2g-timeclock-monthly-test.pdf');
  writeFileSync(artifact, Buffer.from(bytes));
  console.log('PDF artifact:', artifact);
});
