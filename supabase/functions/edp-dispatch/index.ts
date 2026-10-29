import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.8';
import { z } from 'npm:zod@3.25.76';
import { buildBrevoPayload, EdpBrevoError, assertEdpSendEnabled, postBrevoMessage } from '../_shared/edp-brevo.ts';
import { sha256Hex } from '../_shared/edp-documents.ts';
import { buildMailpitPayload, EdpLocalTransportError, parseLocalCaptureUrl, postToLocalCapture } from '../_shared/edp-local.ts';
import { RequestAccessError, requireUser } from '../_shared/organization-request-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const UuidSchema = z.string().uuid();
const RequestSchema = z.object({
  action: z.literal('send'), sale_id: UuidSchema, expected_revision: z.number().int().positive(), idempotency_key: UuidSchema,
}).strict();
const ManifestSchema = z.object({
  version_id: UuidSchema, document_id: UuidSchema, bucket_id: z.literal('edp-client-documents'), storage_path: z.string(),
  filename: z.string(), mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png']), size_bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
const ReserveSchema = z.object({
  dispatch_id: UuidSchema, attempt_id: UuidSchema, state: z.enum(['reserved', 'accepted', 'failed', 'uncertain']),
  same_request: z.boolean(), attachment_manifest: z.array(ManifestSchema),
  snapshot: z.object({
    sale: z.object({ organization_id: UuidSchema }).passthrough(),
    delivery: z.object({
      to: z.array(z.string().email()), cc: z.array(z.string().email()), sender_name: z.string(), sender_email: z.string().email(),
      transport: z.enum(['local_capture', 'brevo']), subject: z.string(), html: z.string(),
    }).strict(),
  }).passthrough(),
}).strict();

type ServiceClient = SupabaseClient;
type Attachment = { readonly filename: string; readonly contentType: string; readonly bytes: Uint8Array };

class EdpDispatchEndpointError extends Error {
  readonly name = 'EdpDispatchEndpointError';

  constructor(readonly status: 400 | 403 | 409 | 500 | 503, message: string) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function createClients(req: Request): { readonly service: ServiceClient; readonly user: SupabaseClient } {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization');
  if (!url || !serviceKey || !anonKey || !authorization) throw new EdpDispatchEndpointError(500, 'Configuração Supabase indisponível');
  return {
    service: createClient(url, serviceKey, { auth: { persistSession: false } }),
    user: createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function loadAttachments(client: ServiceClient, manifest: z.infer<typeof ManifestSchema>[]): Promise<Attachment[]> {
  const attachments: Attachment[] = [];
  for (const item of manifest) {
    const { data, error } = await client.storage.from(item.bucket_id).download(item.storage_path);
    if (error || !data) throw new EdpDispatchEndpointError(409, 'Um anexo selecionado deixou de estar disponível');
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.byteLength !== item.size_bytes || await sha256Hex(bytes) !== item.sha256) {
      throw new EdpDispatchEndpointError(409, 'Um anexo selecionado não corresponde ao manifesto');
    }
    attachments.push({ filename: item.filename, contentType: item.mime_type, bytes });
  }
  return attachments;
}

async function complete(
  client: ServiceClient,
  dispatchId: string,
  attemptId: string,
  state: 'accepted' | 'failed' | 'uncertain',
  messageId: string | null,
  errorCode: string | null,
): Promise<void> {
  const { error } = await client.rpc('edp_complete_dispatch', {
    p_dispatch_id: dispatchId, p_attempt_id: attemptId, p_state: state, p_message_id: messageId, p_error_code: errorCode,
  });
  if (error) throw new EdpDispatchEndpointError(500, 'Não foi possível registar o resultado EDP');
}

async function sendFrozen(client: ServiceClient, reserved: z.infer<typeof ReserveSchema>): Promise<string> {
  const delivery = reserved.snapshot.delivery;
  const attachments = await loadAttachments(client, reserved.attachment_manifest);
  if (delivery.transport === 'local_capture') {
    const endpoint = parseLocalCaptureUrl(Deno.env.get('EDP_LOCAL_CAPTURE_URL') ?? '');
    const payload = buildMailpitPayload({
      from: { email: delivery.sender_email, name: delivery.sender_name }, to: delivery.to, cc: delivery.cc,
      subject: delivery.subject, html: delivery.html, attachments, dispatchId: reserved.dispatch_id,
    });
    return await postToLocalCapture(endpoint, payload);
  }
  const { data: organization, error } = await client.from('organizations').select('brevo_api_key,brevo_sender_email')
    .eq('id', reserved.snapshot.sale.organization_id).maybeSingle();
  if (error || !organization?.brevo_api_key || organization.brevo_sender_email !== delivery.sender_email) {
    throw new EdpBrevoError('configuration', 'Configuração Brevo EDP indisponível');
  }
  const payload = buildBrevoPayload({
    from: { email: delivery.sender_email, name: delivery.sender_name }, to: delivery.to, cc: delivery.cc,
    subject: delivery.subject, html: delivery.html, attachments, dispatchId: reserved.dispatch_id,
  });
  return await postBrevoMessage(organization.brevo_api_key, payload);
}

async function handle(req: Request): Promise<Response> {
  assertEdpSendEnabled(Deno.env.get('EDP_SEND_ENABLED'), true);
  const clients = createClients(req);
  await requireUser(clients.service, req);
  const input = RequestSchema.parse(await req.json());
  const { data, error } = await clients.user.rpc('edp_reserve_dispatch', {
    p_sale_id: input.sale_id, p_expected_revision: input.expected_revision, p_idempotency_key: input.idempotency_key,
  });
  if (error) throw new EdpDispatchEndpointError(error.code === '40001' ? 409 : 403, error.message);
  const reserved = ReserveSchema.parse(data);
  if (reserved.state !== 'reserved') return jsonResponse({ ...reserved, message_id: null });
  const { data: sendSettings, error: sendSettingsError } = await clients.service.from('edp_settings')
    .select('send_enabled').eq('organization_id', reserved.snapshot.sale.organization_id).maybeSingle();
  assertEdpSendEnabled(Deno.env.get('EDP_SEND_ENABLED'), !sendSettingsError && sendSettings?.send_enabled === true);
  const { error: inflightError } = await clients.service.rpc('edp_mark_dispatch_inflight', {
    p_dispatch_id: reserved.dispatch_id, p_attempt_id: reserved.attempt_id,
  });
  if (inflightError) return jsonResponse({ ...reserved, state: 'uncertain', message_id: null }, 409);
  try {
    const messageId = await sendFrozen(clients.service, reserved);
    await complete(clients.service, reserved.dispatch_id, reserved.attempt_id, 'accepted', messageId, null);
    return jsonResponse({ ...reserved, state: 'accepted', message_id: messageId });
  } catch (error) {
    if (error instanceof EdpLocalTransportError || error instanceof EdpBrevoError) {
      const state = error.kind === 'uncertain' ? 'uncertain' : 'failed';
      await complete(clients.service, reserved.dispatch_id, reserved.attempt_id, state, null, error.kind);
      throw new EdpDispatchEndpointError(state === 'uncertain' ? 503 : 500, error.message);
    }
    throw error;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof RequestAccessError) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof EdpDispatchEndpointError) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof EdpBrevoError || error instanceof EdpLocalTransportError || error instanceof z.ZodError) {
      return jsonResponse({ error: error.message }, 400);
    }
    return jsonResponse({ error: 'Erro interno no envio EDP' }, 500);
  }
});
