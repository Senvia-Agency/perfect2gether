import { z } from "npm:zod@3.25.76";
export const queuedEmailSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  state: z.enum(["queued", "processing", "delivered", "failed", "uncertain"]),
  channel: z.literal("email"),
  due_at: z.string(),
  attempts: z.number(),
  claimed_at: z.string().nullable().optional(),
  payload: z.object({ title: z.string().min(1), to: z.string().email() }),
});
export class RhDeliveryUncertainError extends Error {
  readonly kind = "uncertain_delivery";
  constructor(message: string) {
    super(message);
    this.name = "RhDeliveryUncertainError";
  }
}
export type QueuedEmail = z.infer<typeof queuedEmailSchema>;
export type EmailDelivery = {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly idempotencyKey: string;
};
export type WorkerResult = {
  readonly id: string;
  readonly state: "preview" | "delivered" | "failed" | "uncertain";
  readonly error?: string;
};
export async function processRhEmails(
  rows: readonly QueuedEmail[],
  options: {
    readonly now: Date;
    readonly dryRun: boolean;
    readonly deliver: (message: EmailDelivery) => Promise<void>;
    readonly complete: (
      id: string,
      state: "delivered" | "failed" | "uncertain",
      error?: string,
    ) => Promise<void>;
  },
): Promise<readonly WorkerResult[]> {
  const results: WorkerResult[] = [];
  for (const row of rows) {
    if (
      !["queued", "processing", "failed"].includes(row.state) ||
      new Date(row.due_at) > options.now
    )
      continue;
    if (options.dryRun) {
      results.push({ id: row.id, state: "preview" });
      continue;
    }
    try {
      await options.deliver({
        to: row.payload.to,
        subject: row.payload.title,
        body:
          row.payload.title +
          ". Consulte os detalhes na área de Recursos Humanos: https://app.perfect2gether.pt/rh",
        idempotencyKey: row.id,
      });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      const state =
        error instanceof RhDeliveryUncertainError ? "uncertain" : "failed";
      await options.complete(row.id, state, error.message);
      results.push({ id: row.id, state, error: error.message });
      continue;
    }
    try {
      await options.complete(row.id, "delivered");
      results.push({ id: row.id, state: "delivered" });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      await options.complete(row.id, "uncertain", error.message);
      results.push({ id: row.id, state: "uncertain", error: error.message });
    }
  }
  return results;
}
export function isRhSchedulerAuthorized(input: {
  readonly configuredBearer: string | undefined;
  readonly suppliedBearer: string | null;
  readonly configuredSecret: string | undefined;
  readonly suppliedSecret: string | null;
  readonly configuredOrg: string | undefined;
  readonly requestedOrg: string;
}): boolean {
  return (
    !!input.configuredBearer &&
    input.suppliedBearer === `Bearer ${input.configuredBearer}` &&
    !!input.configuredSecret &&
    !!input.configuredOrg &&
    input.suppliedSecret === input.configuredSecret &&
    input.requestedOrg === input.configuredOrg
  );
}
