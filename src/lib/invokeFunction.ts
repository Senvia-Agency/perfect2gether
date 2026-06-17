import { supabase } from '@/integrations/supabase/client';

/**
 * Wrapper for supabase.functions.invoke that surfaces the real error message.
 *
 * Why: in @supabase/supabase-js v2.49+, a non-2xx response throws a
 * FunctionsHttpError with the generic message "Edge Function returned a
 * non-2xx status code", and `data` is set to `null`. The actual JSON body
 * (e.g. `{ error: "Membro não encontrado" }`) lives on `error.context`,
 * which is the underlying Response object.
 *
 * This helper extracts that real message so callers get the Portuguese
 * error string the Edge Function actually returned.
 *
 * It also guards against stale access tokens (see ensureFreshSession below):
 * supabase-js only refreshes the access token on an internal timer, which can
 * miss a beat in the PWA when the app is backgrounded. The next invoke would
 * then send an expired JWT and the function's `getUser()` rejects it with
 * "Utilizador não autenticado" — even though the user never logged out. We
 * refresh proactively before calling, and retry once on a 401.
 */

// Refresh the token if it expires within this window (access tokens last ~1h).
const TOKEN_REFRESH_THRESHOLD_MS = 60_000;

export async function invokeFunction<T = unknown>(
  name: string,
  body?: unknown
): Promise<T> {
  let headers = await freshAuthHeaders();
  let { data, error } = await supabase.functions.invoke(name, { body, headers });

  // Stale-token safety net: if the function rejected the caller's token,
  // force a refresh and retry once before surfacing the error.
  if (error && isAuthError(error)) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
      headers = await freshAuthHeaders();
      ({ data, error } = await supabase.functions.invoke(name, { body, headers }));
    }
  }

  if (error) {
    const realMessage = await extractErrorMessage(error, data);
    throw new Error(realMessage);
  }

  // Some functions return 200 with `{ error: "..." }` in the body
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }

  return data as T;
}

/**
 * Returns an Authorization header with a guaranteed-fresh access token.
 *
 * Reads the current session and, if the access token is expired or about to
 * expire, refreshes it via the (still valid) refresh token before we make the
 * request. Returns undefined when there is no session — the caller then falls
 * back to supabase-js's default headers (anon key).
 */
async function freshAuthHeaders(): Promise<Record<string, string> | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return undefined;

  const expiresInMs = (session.expires_at ?? 0) * 1000 - Date.now();
  if (expiresInMs < TOKEN_REFRESH_THRESHOLD_MS) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const token = refreshed.session?.access_token;
    if (token) return { Authorization: `Bearer ${token}` };
  }

  return { Authorization: `Bearer ${session.access_token}` };
}

function isAuthError(error: unknown): boolean {
  return (error as { context?: { status?: number } })?.context?.status === 401;
}

async function extractErrorMessage(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return String(data.error);
  }

  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      try {
        const text = await ctx.clone().text();
        if (text) return text;
      } catch {
        /* ignore */
      }
    }
  }

  const message = (error as { message?: string })?.message;
  return message || 'Erro ao executar operação';
}
