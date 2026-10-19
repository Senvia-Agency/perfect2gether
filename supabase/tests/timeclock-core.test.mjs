import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(name) { const exports = {}; const source = readFileSync(`src/modules/timeclock/${name}.ts`, 'utf8'); vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: id => load(id.replace('./', '')), Intl, Date, Map, Set }); return exports; }
const domain = () => load('workday');
const entry = (action, at, extra={}) => ({ id: at, user_id:'u', action, punched_at: at, status:'valid', flags:[], note:'', corrected:false, source:'gps', ...extra });
test('Given pause then stop, when summarized, then pause never becomes work', () => {
 const entries=[entry('start','2026-10-19T08:00:00Z'),entry('pause','2026-10-19T10:00:00Z'),entry('stop','2026-10-19T11:00:00Z')];
 const result=domain().summarizeMonth(entries,'2026-10','Europe/Lisbon',Date.parse('2026-10-19T12:00:00Z'));
 assert.equal(result.workSeconds,7200); assert.equal(result.pauseSeconds,3600);
});
test('Given overnight month boundary, when summarized, then only Lisbon month seconds count',()=>{
 const entries=[entry('start','2026-10-31T23:00:00Z'),entry('stop','2026-11-01T02:00:00Z')];
 assert.equal(domain().summarizeMonth(entries,'2026-10','Europe/Lisbon',Date.parse('2026-11-02T00:00:00Z')).workSeconds,3600);
});
test('Given Lisbon DST fall back, when summarized, then elapsed hours use instants',()=>{
 const entries=[entry('start','2026-10-25T00:00:00Z'),entry('stop','2026-10-25T03:00:00Z')];
 assert.equal(domain().summarizeMonth(entries,'2026-10','Europe/Lisbon',Date.parse('2026-10-26T00:00:00Z')).workSeconds,10800);
});
test('Given voided stop and stale open work, when computed, then state closes at twelve hours',()=>{
 const entries=[entry('start','2026-10-19T00:00:00Z'),entry('stop','2026-10-19T01:00:00Z',{status:'voided'})];
 const result=domain().getClockState(entries,Date.parse('2026-10-19T13:00:00Z'),'Europe/Lisbon');
 assert.equal(result.status,'closed'); assert.equal(result.workedSeconds,43200);
});
test('Given manual correction and pending entry, when summarized, then report flags provisional totals and correction marker',()=>{
 const entries=[entry('start','2026-10-19T08:00:00Z',{status:'pending',flags:['manual_time'],note:'Esquecimento'}),entry('stop','2026-10-19T10:00:00Z')];
 const result=domain().summarizeMonth(entries,'2026-10','Europe/Lisbon',Date.parse('2026-10-20T00:00:00Z')).days.find(day=>day.date==='2026-10-19');
 assert.equal(result.workSeconds,7200);assert.equal(result.pending,true);assert.equal(result.corrected,true);assert.equal(result.notes[0],'Esquecimento');
});
test('Given a stop today, when computing state, then resume day expires at twelve hours',()=>{
 const entries=[entry('start','2026-10-19T07:00:00Z'),entry('stop','2026-10-19T08:00:00Z')];
 assert.equal(domain().getClockState(entries,Date.parse('2026-10-19T19:59:59Z')).canResumeDay,true);
 assert.equal(domain().getClockState(entries,Date.parse('2026-10-19T20:00:00Z')).canResumeDay,false);
});
test('Given spring DST shift, when reporting, then missing local hour is never counted',()=>{
 const entries=[entry('start','2026-03-29T00:00:00Z'),entry('stop','2026-03-29T03:00:00Z')];
 assert.equal(domain().summarizeMonth(entries,'2026-03','Europe/Lisbon',Date.parse('2026-03-30T00:00:00Z')).workSeconds,10800);
});
test('Given July month starts in summer time, when an overnight shift crosses it, then clipping uses Lisbon midnight',()=>{
 const entries=[entry('start','2026-06-30T22:00:00Z'),entry('stop','2026-07-01T01:00:00Z')];
 assert.equal(domain().summarizeMonth(entries,'2026-07','Europe/Lisbon',Date.parse('2026-07-02T00:00:00Z')).workSeconds,7200);
});
