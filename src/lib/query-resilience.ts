// PostgREST rejects with plain objects, not necessarily Error instances.
function readError(error: unknown) {
  const value = error && typeof error === 'object'
    ? error as { code?: string; status?: number; message?: string; context?: { status?: number } }
    : {};
  return {
    code: value.code ?? '',
    status: value.status ?? value.context?.status,
    message: value.message ?? String(error),
  };
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const { code, status, message } = readError(error);
  if (
    (status && status >= 400 && status < 500 && status !== 408 && status !== 429) ||
    ['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(code) ||
    /\b(401|403|unauthorized|forbidden)\b/i.test(message)
  ) return false;

  // One spaced retry for availability failures; do not amplify a stalled DB.
  const unavailable = (status && (status >= 500 || status === 408 || status === 429)) ||
    ['PGRST000', 'PGRST001', 'PGRST002', '53300', '57P03', '57014'].includes(code) ||
    /failed to fetch|network|timeout|timed out|\b(429|502|503|504)\b/i.test(message);
  return failureCount < (unavailable ? 1 : 2);
}

export function queryRetryDelay(attempt: number): number {
  // Jitter avoids all dashboard queries/users retrying in the same instant.
  return Math.min(5_000 * 2 ** attempt + Math.random() * 2_500, 30_000);
}

export function requireReadSuccess<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}
