import type { MonthSummary, Person, Snapshot } from '../types';
import { formatDuration, summarizeMonth } from '../workday';
import { clockTime } from '../components/presentation';
export type ReportIdentity = { readonly name: string; readonly nif: string; readonly logo: string | null };
export type PersonReport = { readonly person: Person; readonly summary: MonthSummary };
export function reportsFor(snapshot: Snapshot, month: string, user?: string, nowMs = Date.now()): readonly PersonReport[] {
  return snapshot.people.filter(person => !user || person.id === user).filter(person => person.is_active || snapshot.entries.some(entry => entry.user_id === person.id)).map(person => ({ person, summary: summarizeMonth(snapshot.entries.filter(entry => entry.user_id === person.id), month, snapshot.timezone, nowMs, snapshot.holidays) }));
}
function csvCell(value: string) {
  const safe = /^(?:\s*[=+@-]|[\t\r])/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function monthlyCsv(reports: readonly PersonReport[]): string {
  const rows: string[][] = [['Colaborador', 'Função', 'Data', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Trabalho', 'Pausas', 'Pendente', 'Incompleto', 'Correção manual', 'Feriado', 'Observações']];
  for (const { person, summary } of reports) {
    for (const day of summary.days) rows.push([person.name, person.role, day.date, ...[0, 1].flatMap(index => { const pair = day.pairs[index]; return [pair ? clockTime(pair.in) : '', pair?.out ? clockTime(pair.out) : '']; }), formatDuration(day.workSeconds), formatDuration(day.pauseSeconds), day.pending ? 'Sim' : 'Não', day.incomplete ? 'Sim' : 'Não', day.corrected ? 'Sim' : 'Não', day.holiday ?? '', [...day.pairs.slice(2).map(pair => `${clockTime(pair.in)}-${pair.out ? clockTime(pair.out) : 'aberto'}`), ...day.notes, ...day.flags].join(' · ')]);
    rows.push([person.name, person.role, 'TOTAL', '', '', '', '', formatDuration(summary.workSeconds), formatDuration(summary.pauseSeconds), '', String(summary.incompleteDays), '', '', '']);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}
export function downloadCsv(reports: readonly PersonReport[], month: string) {
  const url = URL.createObjectURL(new Blob([monthlyCsv(reports)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `folha-ponto-${month}.csv`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
