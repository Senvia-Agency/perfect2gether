import { z } from 'zod';
export const actionSchema = z.enum(['start', 'pause', 'resume', 'stop']);
export type Action = z.infer<typeof actionSchema>;
export const entrySchema = z.object({
  id: z.string(), organization_id: z.string(), user_id: z.string(),
  entry_type: z.enum(['in', 'out']), kind: z.enum(['work', 'pause']), action: actionSchema,
  punched_at: z.string().datetime({ offset: true }), created_at: z.string().datetime({ offset: true }),
  status: z.enum(['valid', 'flagged', 'pending', 'voided']), flags: z.array(z.string()), note: z.string().max(300),
  location_id: z.string().nullable(), location_name: z.string().nullable(), address: z.string().nullable(),
  distance_m: z.number().nullable(), source: z.enum(['gps', 'nfc', 'admin']), corrected: z.boolean(),
});
export type Entry = z.infer<typeof entrySchema>;
export const personSchema = z.object({ id: z.string(), name: z.string(), avatar: z.string().nullable(), role: z.string(), is_active: z.boolean() });
export type Person = z.infer<typeof personSchema>;
export const locationSchema = z.object({ id: z.string(), name: z.string(), latitude: z.number(), longitude: z.number(), radius_m: z.number(), max_accuracy_m: z.number(), gps_only: z.boolean(), block_vpn: z.boolean(), trusted_ips: z.array(z.string()), is_active: z.boolean() });
export type Location = z.infer<typeof locationSchema>;
export const scheduleSchema = z.object({ user_id: z.string(), weekdays: z.array(z.number()), start_time: z.string(), lunch_time: z.string(), return_time: z.string(), end_time: z.string(), tolerance_minutes: z.number(), enabled: z.boolean() });
export type Schedule = z.infer<typeof scheduleSchema>;
export const snapshotSchema = z.object({
  server_now: z.string(), timezone: z.literal('Europe/Lisbon'), can_manage: z.boolean(), can_configure: z.boolean(),
  report_identity: z.object({ name: z.string(), nif: z.string(), logo_url: z.string().nullable() }),
  entries: z.array(entrySchema), people: z.array(personSchema), locations: z.array(locationSchema), schedules: z.array(scheduleSchema),
  tags: z.array(z.object({ id: z.string(), location_id: z.string(), name: z.string(), kind: z.enum(['static', 'ntag424']), is_active: z.boolean(), last_counter: z.number() })),
  holidays: z.array(z.object({ date: z.string(), name: z.string() })),
  history: z.array(z.object({ id: z.string(), entry_id: z.string().nullable(), actor_id: z.string(), action: z.string(), reason: z.string(), created_at: z.string(), before: z.unknown(), after: z.unknown() })),
  notifications: z.array(z.object({ id: z.string(), user_id: z.string(), title: z.string(), body: z.string(), created_at: z.string(), read_at: z.string().nullable() })),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type DaySummary = { readonly date: string; readonly workSeconds: number; readonly pauseSeconds: number; readonly incomplete: boolean; readonly pending: boolean; readonly flags: readonly string[]; readonly corrected: boolean; readonly pairs: readonly { readonly in: string; readonly out: string | null }[]; readonly notes: readonly string[]; readonly holiday: string | null };
export type MonthSummary = { readonly days: readonly DaySummary[]; readonly workSeconds: number; readonly pauseSeconds: number; readonly daysWithEntries: number; readonly incompleteDays: number; readonly averageSeconds: number };
export type ClockState = { readonly status: 'closed' | 'working' | 'paused'; readonly workedSeconds: number; readonly pauseSeconds: number; readonly currentPauseSeconds: number; readonly canResumeDay: boolean; readonly startedAt: string | null; readonly lastAt: string | null };
export type Position = { readonly latitude: number; readonly longitude: number; readonly accuracy: number; readonly age_ms: number };
export type PunchOptions = { readonly note?: string; readonly at?: string; readonly tag?: { readonly id: string; readonly token?: string; readonly counter?: number; readonly picc_data?: string; readonly cmac?: string } };
export type PunchInput = PunchOptions & { readonly org: string; readonly request_id: string; readonly action: Action; readonly position: Position | null; readonly device_id: string };
export const punchOptionsSchema = z.object({
  note: z.string().max(300).optional(), at: z.string().datetime({ offset: true }).optional(),
  tag: z.object({ id: z.string(), token: z.string().optional(), counter: z.number().int().nonnegative().optional(), picc_data: z.string().optional(), cmac: z.string().optional() }).optional(),
}).superRefine((input, context) => {
  if ((input.tag?.picc_data || input.tag?.cmac) && input.tag.counter === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ['tag', 'counter'], message: 'Contador obrigatório para NFC seguro.' });
});
