import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { requireUser, requireOrganizationMember, RequestAccessError } from '../_shared/organization-request-auth.ts';
import { certificateApi, requestSchema } from './apify.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Método não permitido' }, 405);
  // Catch-all at the HTTP boundary deliberately returns no provider errors or secrets.
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
      const { data: claim, error } = await db.rpc('claim_client_certificate_lookup', { p_org: input.organizationId, p_user: userId, p_crc: input.crcCode });
      if (error || typeof claim !== 'string') return reply({ error: 'Aguarde antes de iniciar outra consulta.' }, 429);
      const providerRun = await api.start(input.crcCode);
      const { error: saveError } = await db.from('client_certificate_lookups').update({ provider_run_id: providerRun }).eq('id', claim);
      if (saveError) return reply({ error: 'Não foi possível guardar a consulta.' }, 503);
      return reply({ runId: claim, status: 'RUNNING' });
    }
    const { data: lookup, error } = await db.from('client_certificate_lookups').select('provider_run_id,result,status,created_at').eq('id', input.runId).eq('organization_id', input.organizationId).eq('user_id', userId).maybeSingle();
    if (error || !lookup) return reply({ error: 'Consulta não encontrada' }, 404);
    if (lookup.status !== 'RUNNING') return reply({ status: lookup.status, ...(lookup.status === 'FAILED' ? { error: 'Não foi possível obter dados completos da certidão. Confirme o código CRC.' } : {}), ...(lookup.result ? { data: lookup.result } : {}) });
    if (!lookup.provider_run_id || Date.now() - Date.parse(lookup.created_at) > 3600000) return reply({ status: 'FAILED' });
    const result = await api.status(lookup.provider_run_id);
    if (result.status !== 'RUNNING') {
      const { error: saveError } = await db.from('client_certificate_lookups').update({ status: result.status, result: result.data ?? null }).eq('id', input.runId);
      if (saveError) return reply({ error: 'Não foi possível guardar o resultado.' }, 503);
    }
    return reply(result);
  } catch (error) {
    if (error instanceof RequestAccessError) return reply({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return reply({ error: 'JSON inválido' }, 400);
    return reply({ error: 'Não foi possível consultar a certidão. Tente novamente mais tarde.' }, 502);
  }
});

