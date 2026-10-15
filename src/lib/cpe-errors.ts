import { z } from 'zod';

export const CPE_DUPLICATE_MESSAGE = 'Este CPE já existe para este NIF.';
const databaseErrorSchema = z.object({ code: z.string(), message: z.string() });

export function getCpeSaveError(error: unknown, fallback: string): string {
  const parsed = databaseErrorSchema.safeParse(error);
  return parsed.success && parsed.data.code === '23505' && parsed.data.message === CPE_DUPLICATE_MESSAGE
    ? CPE_DUPLICATE_MESSAGE
    : fallback;
}
