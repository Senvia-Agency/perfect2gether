import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { entrySchema, punchOptionsSchema, snapshotSchema } from './types';
import type { PunchInput } from './types';
export class ClockApiError extends Error {
  constructor(readonly code: string, message: string, readonly retryable = false) { super(message); this.name = 'ClockApiError'; }
}
function publicError(code: string, detail: string, status = 0): ClockApiError {
  const value = `${code} ${detail}`.toLowerCase();
  if (/pgrst202|42p01|42883|backend_missing|backend_unavailable|function.*not found|could not find.*function/.test(value) || status === 404) return new ClockApiError('backend_unavailable', 'O ponto ainda não está disponível neste ambiente. Tente novamente mais tarde.');
  if (/invalid_state/.test(value)) return new ClockApiError('invalid_state', 'A sequência de registos mudou. Atualize o ponto e escolha a ação disponível.');
  if (/manual_time|invalid_time/.test(value)) return new ClockApiError('manual_time', 'Indique uma hora de hoje, nas últimas 12 horas, posterior ao último registo e anterior à hora atual.');
  if (/invalid_nfc|nfc|tag_not_found|counter|cmac/.test(value)) return new ClockApiError('nfc', 'Não foi possível validar esta tag NFC. Volte a aproximar o telemóvel de uma tag válida.');
  if (/vpn|tor_blocked/.test(value)) return new ClockApiError('network_blocked', 'Este local não permite registos através de VPN ou Tor. Desative a ligação e tente novamente.');
  if (/access|forbidden|permission|membership|manage_required|configure_required|42501|unauthorized|auth|mfa/.test(value) || status === 401 || status === 403) return new ClockApiError('access', 'A sua sessão ou permissão não permite esta ação. Confirme o acesso com o responsável.');
  if (/reason_required/.test(value)) return new ClockApiError('reason', 'Indique uma justificação com pelo menos 3 letras.');
  if (/network|fetch|relay|timeout|offline/.test(value) || code === '' || status >= 500) return new ClockApiError('network', 'Não foi possível contactar o ponto. Verifique a ligação e tente novamente.', true);
  return new ClockApiError('rejected', 'Não foi possível concluir esta ação. Atualize o ponto e tente novamente.');
}
const errorSchema = z.object({ error: z.string().optional(), code: z.string().optional(), message: z.string().optional() });
async function invoke(name: string, body: object): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke<unknown>(name, { body });
  if (error instanceof FunctionsHttpError) {
    const response: unknown = await error.context.json().catch(() => null);
    const parsed = errorSchema.safeParse(response);
    throw publicError(parsed.success ? parsed.data.code ?? parsed.data.error ?? 'rejected' : 'rejected', parsed.success ? parsed.data.message ?? parsed.data.error ?? '' : '', error.context.status);
  }
  if (error) throw publicError(error instanceof FunctionsFetchError || error instanceof FunctionsRelayError ? 'network' : 'rejected', error.message);
  return data;
}
export const clockApi = {
  async call(action: string, payload: { [key: string]: Json | undefined }): Promise<unknown> {
    const { data, error } = await supabase.rpc('p2g_clock', { action, payload });
    if (error) throw publicError(error.code, error.message);
    return data;
  },
  async snapshot(org: string, month: string, user?: string) {
    const parsed = snapshotSchema.safeParse(await clockApi.call('snapshot', { org, month, ...(user ? { user } : {}) }));
    if (!parsed.success) throw new ClockApiError('invalid_response', 'Não foi possível carregar os dados do ponto. Atualize e tente novamente.');
    return parsed.data;
  },
  async punch(input: PunchInput) {
    if (!punchOptionsSchema.safeParse(input).success) throw new ClockApiError('invalid_input', 'Verifique a hora, a tag NFC e a observação (máximo de 300 caracteres).');
    const result = z.object({ entry: entrySchema, duplicate: z.boolean() }).safeParse(await invoke('clock-punch', input));
    if (!result.success) throw new ClockApiError('invalid_response', 'Não foi possível confirmar o registo. Tente novamente para consultar o resultado.', true);
    return result.data;
  },
  async manageTag(input: { [key: string]: Json | undefined }): Promise<unknown> {
    return invoke('clock-tag-manage', input);
  },
};
