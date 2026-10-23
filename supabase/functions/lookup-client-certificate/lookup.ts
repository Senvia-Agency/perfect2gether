import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { z } from 'zod';
import { certificateApi, certificateSchema } from './apify.ts';

export const lookupSchema = z.object({
  id: z.string().uuid(), provider_run_id: z.string().nullable(),
  status: z.enum(['RUNNING','SUCCEEDED','FAILED']), phase: z.enum(['QUEUED','EXTRACTING']),
  created_at: z.string(), checked_at: z.string().nullable(), result: certificateSchema.nullable(),
  launch: z.boolean().optional(), cached: z.boolean().optional(),
});
type Lookup = z.infer<typeof lookupSchema>;
type Api = ReturnType<typeof certificateApi>;
const safeError = 'Não foi possível obter dados completos da certidão. Confirme o código CRC.';
export function lookupResponse(lookup: Lookup) {
  return {
    runId: lookup.id, status: lookup.status, phase: lookup.phase, startedAt: lookup.created_at,
    ...(lookup.status === 'SUCCEEDED' ? { data: lookup.result, checkedAt: lookup.checked_at, cached: lookup.cached ?? false } : {}),
    ...(lookup.status === 'FAILED' ? { error: safeError } : {}),
  };
}

export async function launchLookup(context: { readonly db: SupabaseClient; readonly api: Api; readonly lookup: Lookup; readonly crcCode: string }): Promise<void> {
  try {
    const providerRun = await context.api.start(context.crcCode);
    const { error } = await context.db.from('client_certificate_lookups').update({ provider_run_id: providerRun, phase: 'EXTRACTING' }).eq('id', context.lookup.id);
    if (error) await context.db.from('client_certificate_lookups').update({ status: 'FAILED' }).eq('id', context.lookup.id);
  } catch {
    // An ambiguous provider acknowledgement must never cause a second paid POST.
    await context.db.from('client_certificate_lookups').update({ status: 'FAILED' }).eq('id', context.lookup.id);
  }
}

export async function refreshLookup(context: { readonly db: SupabaseClient; readonly api: Api; readonly lookup: Lookup }): Promise<Lookup> {
  const { db, api, lookup } = context;
  if (lookup.status !== 'RUNNING') return lookup;
  const age = Date.now() - Date.parse(lookup.created_at);
  if (!lookup.provider_run_id && age > 300000) {
    await db.from('client_certificate_lookups').update({ status: 'FAILED' }).eq('id', lookup.id);
    return { ...lookup, status: 'FAILED' };
  }
  if (!lookup.provider_run_id) return lookup;
  const result = await api.status(lookup.provider_run_id);
  if (result.status === 'RUNNING' && age <= 300000) return lookup;
  const checkedAt = result.status === 'SUCCEEDED' ? result.checkedAt ?? null : null;
  const next = { ...lookup, status: result.status === 'RUNNING' ? 'FAILED' as const : result.status, result: result.data ?? null, checked_at: checkedAt };
  const { error } = await db.from('client_certificate_lookups').update({ status: next.status, result: next.result, checked_at: next.checked_at }).eq('id', lookup.id).eq('status', 'RUNNING');
  if (error) throw new LookupPersistenceError();
  // Concurrent polls must return the first persisted completion timestamp.
  const { data, error: readError } = await db.from('client_certificate_lookups').select('*').eq('id', lookup.id).single();
  if (readError) throw new LookupPersistenceError();
  return lookupSchema.parse(data);
}
class LookupPersistenceError extends Error { constructor() { super('Certificate persistence unavailable'); } }


