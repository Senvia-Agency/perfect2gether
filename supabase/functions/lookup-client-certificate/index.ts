import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { requireUser, requireOrganizationMember, RequestAccessError } from '../_shared/organization-request-auth.ts';
import { certificateApi, requestSchema } from './apify.ts';
import { launchLookup, lookupSchema, lookupResponse, refreshLookup } from './lookup.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Método não permitido' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const token = Deno.env.get('APIFY_API_TOKEN');
    if (!url || !key || !token) return reply({ error: 'Consulta de certidão indisponível' }, 503);
    const db = createClient(url, key, { auth: { persistSession: false } });
    const userId = await requireUser(db, req);
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return reply({ error: 'Pedido inválido. Código CRC: 0000-0000-0000.' }, 400);
    const input = parsed.data;
    await requireOrganizationMember(db, { userId, organizationId: input.organizationId });
    if (input.organizationId !== '96a3950e-31be-4c6d-abed-b82968c0d7e9') return reply({ error: 'Consulta não disponível nesta organização' }, 403);
    const api = certificateApi({ token, taskId: Deno.env.get('APIFY_CERTIFICATE_TASK_ID') || 'ScJCNev9cjvPW5dU7' });
    if (input.action === 'start') {
      const { data, error } = await db.rpc('reserve_client_certificate', { p_org: input.organizationId, p_user: userId, p_crc: input.crcCode, p_request: input.requestId ?? crypto.randomUUID() });
      if (error) return reply({ error: 'Aguarde antes de iniciar outra consulta.' }, 429);
      const lookup = lookupSchema.parse(data);
      if (lookup.launch) EdgeRuntime.waitUntil(launchLookup({ db, api, lookup, crcCode: input.crcCode }));
      return reply(lookupResponse(lookup));
    }
    const { data, error } = await db.from('client_certificate_lookups').select('*').eq('id', input.runId).eq('organization_id', input.organizationId).eq('user_id', userId).maybeSingle();
    if (error || !data) return reply({ error: 'Consulta não encontrada' }, 404);
    const lookup = await refreshLookup({ db, api, lookup: lookupSchema.parse(data) });
    return reply(lookupResponse(lookup));
  } catch (error) {
    if (error instanceof RequestAccessError) return reply({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return reply({ error: 'JSON inválido' }, 400);
    return reply({ error: 'Não foi possível consultar a certidão. Tente novamente mais tarde.' }, 502);
  }
});
