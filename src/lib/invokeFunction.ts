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
 */
export async function invokeFunction<T = unknown>(
  name: string,
  body?: unknown
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

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
