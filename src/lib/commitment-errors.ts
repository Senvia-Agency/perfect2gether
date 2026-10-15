import { z } from 'zod';

export const COMMITMENT_LOCK_MESSAGE = 'Já registou o compromisso deste mês. Apenas um administrador ou gestor de compromissos pode corrigir os valores.';
export class CommitmentAlreadySavedError extends Error {
  constructor() { super(COMMITMENT_LOCK_MESSAGE); this.name = 'CommitmentAlreadySavedError'; }
}
const databaseErrorSchema = z.object({ code: z.string().optional(), message: z.string() });
export function getCommitmentSaveError(error: unknown, lockEnabled: boolean): string {
  if (error instanceof CommitmentAlreadySavedError) return COMMITMENT_LOCK_MESSAGE;
  const parsed = databaseErrorSchema.safeParse(error);
  if (lockEnabled && parsed.success && parsed.data.code === '23505') return COMMITMENT_LOCK_MESSAGE;
  return parsed.success ? `Erro ao guardar compromisso: ${parsed.data.message}` : 'Erro ao guardar compromisso';
}
