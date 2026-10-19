import type { ClockState, DaySummary, Entry, MonthSummary } from './types';
export const TIMEZONE = 'Europe/Lisbon';
export const MAX_SEGMENT_MS = 12 * 60 * 60 * 1000;
const formatters = new Map<string, Intl.DateTimeFormat>();
const midnights = new Map<string, number>();
export function localDate(value: number | string = Date.now(), timezone = TIMEZONE): string {
  let formatter = formatters.get(timezone);
  if (!formatter) { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }); formatters.set(timezone, formatter); }
  const parts = formatter.formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function currentMonth(nowMs = Date.now(), timezone = TIMEZONE): string { return localDate(nowMs, timezone).slice(0, 7); }
function nextDate(date: string): string { return new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10); }
function midnight(date: string, timezone: string): number {
  const key = timezone + date, cached = midnights.get(key);
  if (cached !== undefined) return cached;
  const utc = Date.parse(`${date}T00:00:00Z`);
  let lower = utc - 86400000, upper = utc + 86400000;
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2);
    if (localDate(middle, timezone) < date) lower = middle; else upper = middle;
  }
  midnights.set(key, upper);
  return upper;
}
export function effectiveEntries(entries: readonly Entry[], nowMs: number): Entry[] {
  return entries.filter(entry => entry.status !== 'voided' && Date.parse(entry.punched_at) <= nowMs)
    .sort((a, b) => Date.parse(a.punched_at) - Date.parse(b.punched_at) || a.id.localeCompare(b.id));
}
type Segment = { readonly entry: Entry; readonly endEntry: Entry | undefined; readonly start: number; readonly end: number; readonly incomplete: boolean; readonly work: boolean };
function segments(entries: readonly Entry[], nowMs: number): Segment[] {
  return entries.flatMap((entry, index) => {
    if (entry.action === 'stop') return [];
    const next = entries[index + 1];
    const start = Date.parse(entry.punched_at), nextAt = next ? Date.parse(next.punched_at) : nowMs;
    const validClose = next && (entry.action === 'pause' ? next.action === 'resume' || next.action === 'stop' : next.action === 'pause' || next.action === 'stop');
    const end = Math.min(nextAt, start + MAX_SEGMENT_MS, nowMs);
    return [{ entry, endEntry: validClose ? next : undefined, start, end, incomplete: !validClose || nextAt - start > MAX_SEGMENT_MS, work: entry.action !== 'pause' }];
  });
}
export function summarizeMonth(entries: readonly Entry[], month: string, timezone = TIMEZONE, nowMs = Date.now(), holidays: readonly { readonly date?: string; readonly name?: string }[] = []): MonthSummary {
  const live = effectiveEntries(entries, nowMs), spans = segments(live, nowMs);
  const entryDates = new Map(live.map(entry => [entry.id, localDate(entry.punched_at, timezone)]));
  const days: DaySummary[] = [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { days, workSeconds: 0, pauseSeconds: 0, daysWithEntries: 0, incompleteDays: 0, averageSeconds: 0 };
  for (let date = `${month}-01`; date.startsWith(month); date = nextDate(date)) {
    const start = midnight(date, timezone), end = midnight(nextDate(date), timezone);
    const own = live.filter(entry => entryDates.get(entry.id) === date);
    const overlaps = spans.filter(span => span.start < end && span.end > start);
    const related = [...own, ...overlaps.flatMap(span => span.endEntry ? [span.entry, span.endEntry] : [span.entry])];
    const seconds = (work: boolean) => Math.floor(overlaps.filter(span => span.work === work).reduce((sum, span) => sum + Math.max(0, Math.min(end, span.end) - Math.max(start, span.start)), 0) / 1000);
    days.push({ date, workSeconds: seconds(true), pauseSeconds: seconds(false),
      incomplete: overlaps.some(span => span.incomplete) || own.some(entry => entry.action === 'start' && !spans.some(span => span.entry.id === entry.id && !span.incomplete)),
      pending: related.some(entry => entry.status === 'pending'), flags: [...new Set(related.flatMap(entry => entry.flags))],
      corrected: related.some(entry => entry.corrected || entry.source === 'admin' || entry.flags.includes('manual_time')),
      pairs: overlaps.filter(span => span.work).map(span => ({ in: new Date(Math.max(start, span.start)).toISOString(), out: span.endEntry ? new Date(Math.min(end, span.end)).toISOString() : null })),
      notes: [...new Set(related.map(entry => entry.note).filter(Boolean))], holiday: holidays.find(holiday => holiday.date === date)?.name ?? null,
    });
  }
  const workSeconds = days.reduce((sum, day) => sum + day.workSeconds, 0);
  const daysWithEntries = days.filter(day => day.pairs.length > 0 || day.pauseSeconds > 0 || live.some(entry => entryDates.get(entry.id) === day.date)).length;
  return { days, workSeconds, pauseSeconds: days.reduce((sum, day) => sum + day.pauseSeconds, 0), daysWithEntries, incompleteDays: days.filter(day => day.incomplete).length, averageSeconds: daysWithEntries ? Math.floor(workSeconds / daysWithEntries) : 0 };
}
export function getClockState(entries: readonly Entry[], nowMs: number, timezone = TIMEZONE): ClockState {
  const live = effectiveEntries(entries, nowMs), last = live.at(-1), today = localDate(nowMs, timezone);
  const day = summarizeMonth(live, today.slice(0, 7), timezone, nowMs).days.find(item => item.date === today);
  const recent = !!last && nowMs - Date.parse(last.punched_at) < MAX_SEGMENT_MS;
  const status = !recent || last?.action === 'stop' ? 'closed' : last?.action === 'pause' ? 'paused' : 'working';
  const session = [...live].reverse().find(entry => entry.action === 'start');
  return { status, workedSeconds: day?.workSeconds ?? 0, pauseSeconds: day?.pauseSeconds ?? 0,
    currentPauseSeconds: status === 'paused' && last ? Math.floor((nowMs - Date.parse(last.punched_at)) / 1000) : 0,
    canResumeDay: recent && last?.action === 'stop' && localDate(last.punched_at, timezone) === today,
    startedAt: session && (recent || localDate(session.punched_at, timezone) === today) ? session.punched_at : null,
    lastAt: last?.punched_at ?? null };
}
export function formatDuration(seconds: number, withSeconds = false): string {
  const total = Math.max(0, Math.floor(seconds)), hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}${withSeconds ? `:${String(total % 60).padStart(2, '0')}` : ''}`;
}
