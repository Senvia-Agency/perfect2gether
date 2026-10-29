import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const dates = {};
new Function('exports', ts.transpile(fs.readFileSync('src/lib/prospects/dates.ts', 'utf8'), {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(dates);
test('calendar dates reject invalid days without shifting the company opening day', () => {
  assert.equal(dates.calendarDate('2026-10-22'),'2026-10-22');
  assert.equal(dates.calendarDate('2026-02-30'),null);
  assert.equal(dates.calendarDate(''),null);
  assert.equal(dates.formatProspectDate('2026-10-22'),'22/10/2026');
});
test('imported timestamps filter by Lisbon day including daylight saving midnight', () => {
  assert.equal(dates.prospectImportDate('2026-10-22T23:30:00Z'),'2026-10-23');
  assert.equal(dates.prospectImportDate('2026-12-22T23:30:00Z'),'2026-12-22');
  assert.equal(dates.prospectImportDate('broken'),null);
});
test('only constitution publications can serve as an explicitly identified MJ opening reference', () => {
  const metadata={source_portal:'publicacoes.mj.pt',acto:'Constituição de sociedade',publication_date:'2026-10-22'};
  assert.deepEqual(dates.prospectOpeningDate({metadata}),{date:'2026-10-22',publication:true});
  assert.equal(dates.prospectOpeningDate({metadata:{...metadata,acto:'Mudança de sede'}}).date,null);
  assert.deepEqual(dates.prospectOpeningDate({metadata:{...metadata,opening_date:'2026-10-20'}}),{date:'2026-10-20',publication:false});
  assert.equal(dates.prospectOpeningDate({metadata:{}}).date,null);
});
test('both inclusive date ranges combine and missing dates are excluded only when filtered', () => {
  const day='2026-10-22';
  assert.equal(dates.matchesProspectDateRange(day,{from:day,to:day}),true);
  assert.equal(dates.matchesProspectDateRange(day,{from:'2026-10-23',to:''}),false);
  assert.equal(dates.matchesProspectDateRange(day,{from:'',to:'2026-10-21'}),false);
  assert.equal(dates.matchesProspectDateRange(null,{from:'',to:''}),true);
  assert.equal(dates.matchesProspectDateRange(null,{from:day,to:''}),false);
  assert.equal(dates.matchesProspectDateRange(day,{from:'2026-10-23',to:'2026-10-21'}),false);
  const rows=[{imported:'2026-10-23',opened:'2026-10-22'},{imported:'2026-10-23',opened:'2026-10-21'},{imported:'2026-10-22',opened:'2026-10-22'}];
  assert.equal(rows.filter(row=>dates.matchesProspectDateRange(row.imported,{from:'2026-10-23',to:'2026-10-23'})&&dates.matchesProspectDateRange(row.opened,{from:day,to:day})).length,1);
});
test('prospect list removes COM and wires both ranges into selection and exports', () => {
  const source=fs.readFileSync('src/pages/Prospects.tsx','utf8');
  assert.doesNotMatch(source,/getProspectCom|comFilter|Todos os COM|<TableHead>COM/);
  assert.match(source,/matchesSearch && matchesSalesperson && matchesImported && matchesOpening/);
  assert.match(source,/\[searchQuery, salespersonFilter, importedDates, openingDates[\],]/);
  const exportSource=fs.readFileSync('src/lib/export.ts','utf8');
  assert.doesNotMatch(exportSource,/'COM':/);
  assert.match(exportSource,/'Data de Abertura':/);
});
