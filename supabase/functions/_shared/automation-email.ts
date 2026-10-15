import { z } from 'https://esm.sh/zod@3.25.76';

const triggerConfig = z.object({
  from_status: z.string().optional(),
  to_status: z.string().optional(),
});
const sendResult = z.object({
  success: z.literal(true),
  summary: z.object({ total: z.literal(1), sent: z.literal(1), failed: z.literal(0) }),
});

export function matchesAutomationTrigger(
  config: unknown,
  record: Readonly<Record<string, unknown>>,
  oldRecord?: Readonly<Record<string, unknown>>,
): boolean {
  const value: unknown = typeof config === 'string' ? JSON.parse(config) : config;
  const rule = triggerConfig.parse(value ?? {});
  return (!rule.to_status || record.status === rule.to_status)
    && (!rule.from_status || rule.from_status === 'any' || oldRecord?.status === rule.from_status);
}

export function automationEmailWasSent(data: unknown): boolean {
  return sendResult.safeParse(data).success;
}
