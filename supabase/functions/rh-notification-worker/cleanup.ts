import { z } from "npm:zod@3.25.76";
export const cleanupSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  path: z.string().min(1),
  claimed_at: z.string(),
});
export type StorageCleanup = z.infer<typeof cleanupSchema>;
export async function processRhStorageCleanups(
  jobs: readonly StorageCleanup[],
  adapter: {
    readonly remove: (path: string) => Promise<void>;
    readonly complete: (
      job: StorageCleanup,
      state: "done" | "failed",
      error?: string,
    ) => Promise<void>;
  },
): Promise<void> {
  for (const job of jobs) {
    try {
      await adapter.remove(job.path);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      await adapter.complete(job, "failed", error.message);
      continue;
    }
    await adapter.complete(job, "done");
  }
}
