import type { Action, Entry } from '../types';

export const actionLabels: Readonly<Record<Action, string>> = { start: 'Início', pause: 'Pausa', resume: 'Retoma', stop: 'Fim do dia' };
export const statusLabels = { valid: 'Validado', flagged: 'Sinalizado', pending: 'Pendente', voided: 'Anulado' } as const;
export const stateLabels = { closed: 'Dia terminado', working: 'A trabalhar', paused: 'Em pausa' } as const;
export function clockTime(value: string | number) {
  return new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' }).format(new Date(value));
}
export function dayLabel(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(value + 'T12:00:00Z'));
}
export function entryLocation(entry: Entry) { return entry.location_name || entry.address || 'Sem localização'; }
export function localInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
