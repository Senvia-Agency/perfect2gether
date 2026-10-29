import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.8';
import { z } from 'npm:zod@3.25.76';
import { RequestAccessError, requireUser } from '../_shared/organization-request-auth.ts';
import {
  buildEdpStoragePath,
  EDP_DOCUMENT_BUCKET,
  EdpDocumentError,
  sha256Hex,
  suggestEdpValidityDate,
  validateEdpDocument,
} from '../_shared/edp-documents.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const UuidSchema = z.string().uuid();
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const UploadSchema = z.object({
  client_id: UuidSchema,
  document_id: UuidSchema.optional(),
  person_id: UuidSchema.optional(),
  category: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  side: z.enum(['single', 'front', 'back']),
  validity_confirmed_on: DateSchema.optional(),
}).strict();
const JsonActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('signed_url'), version_id: UuidSchema }).strict(),
  z.object({ action: z.literal('archive'), document_id: UuidSchema }).strict(),
]);

class EdpDocumentsEndpointError extends Error {
  readonly name = 'EdpDocumentsEndpointError';

  constructor(readonly status: 400 | 403 | 404 | 500, message: string) {
    super(message);
  }
}

type Clients = {
  readonly service: SupabaseClient;
  readonly user: SupabaseClient;
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function createClients(req: Request): Clients {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization');
  if (!url || !serviceKey || !anonKey || !authorization) {
    throw new EdpDocumentsEndpointError(500, 'Configuração Supabase indisponível');
  }
  return {
    service: createClient(url, serviceKey, { auth: { persistSession: false } }),
    user: createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function upload(req: Request, clients: Clients, userId: string): Promise<Response> {
  const form = await req.formData();
  const parsed = UploadSchema.parse({
    client_id: form.get('client_id'), document_id: form.get('document_id') || undefined,
    person_id: form.get('person_id') || undefined, category: form.get('category'), label: form.get('label'),
    side: form.get('side'), validity_confirmed_on: form.get('validity_confirmed_on') || undefined,
  });
  const file = form.get('file');
  if (!(file instanceof File)) throw new EdpDocumentsEndpointError(400, 'Ficheiro obrigatório');
  const { data: client, error: clientError } = await clients.user.from('crm_clients')
    .select('id,organization_id').eq('id', parsed.client_id).maybeSingle();
  if (clientError || !client) throw new EdpDocumentsEndpointError(403, 'Cliente indisponível');
  const { error: writeAccessError } = await clients.user.rpc('edp_assert_client_document_write', { p_client_id: client.id });
  if (writeAccessError) throw new EdpDocumentsEndpointError(403, 'Sem acesso aos documentos deste cliente');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateEdpDocument(bytes, file.type, file.name);
  const documentId = parsed.document_id ?? crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const path = buildEdpStoragePath({
    organizationId: client.organization_id, clientId: client.id, documentId, versionId, mimeType: validated.mimeType,
  });
  const sha256 = await sha256Hex(bytes);
  const suggested = suggestEdpValidityDate(bytes, validated.mimeType, new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' }));
  const { error: uploadError } = await clients.service.storage.from(EDP_DOCUMENT_BUCKET).upload(path, bytes, {
    contentType: validated.mimeType, upsert: false,
  });
  if (uploadError) throw new EdpDocumentsEndpointError(500, 'Não foi possível guardar o ficheiro');
  const { data, error } = await clients.service.rpc('edp_register_document_version', {
    p_document_id: documentId, p_version_id: versionId, p_user_id: userId,
    p_organization_id: client.organization_id, p_client_id: client.id, p_person_id: parsed.person_id ?? null,
    p_category: parsed.category, p_label: parsed.label, p_side: parsed.side, p_storage_path: path,
    p_original_name: validated.originalName, p_mime_type: validated.mimeType, p_size_bytes: validated.sizeBytes,
    p_sha256: sha256, p_validity_suggested_on: suggested, p_validity_confirmed_on: parsed.validity_confirmed_on ?? null,
  });
  if (error) {
    const { error: cleanupError } = await clients.service.storage.from(EDP_DOCUMENT_BUCKET).remove([path]);
    if (cleanupError) throw new EdpDocumentsEndpointError(500, 'Falha ao registar e limpar o ficheiro');
    throw new EdpDocumentsEndpointError(400, 'Não foi possível registar o documento');
  }
  return jsonResponse(data, 201);
}

async function jsonAction(req: Request, clients: Clients): Promise<Response> {
  const action = JsonActionSchema.parse(await req.json());
  if (action.action === 'archive') {
    const { data, error } = await clients.user.rpc('edp_archive_document', { p_document_id: action.document_id });
    if (error) throw new EdpDocumentsEndpointError(403, 'Documento indisponível');
    return jsonResponse(data);
  }
  const { data: version, error } = await clients.user.from('client_document_versions')
    .select('bucket_id,storage_path').eq('id', action.version_id).maybeSingle();
  if (error || !version) throw new EdpDocumentsEndpointError(404, 'Versão indisponível');
  const { data, error: signedError } = await clients.service.storage.from(version.bucket_id).createSignedUrl(version.storage_path, 60);
  if (signedError || !data) throw new EdpDocumentsEndpointError(500, 'Não foi possível autorizar a descarga');
  return jsonResponse({ url: data.signedUrl, expires_in: 60 });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const clients = createClients(req);
    const userId = await requireUser(clients.service, req);
    if (req.headers.get('content-type')?.includes('multipart/form-data')) return await upload(req, clients, userId);
    return await jsonAction(req, clients);
  } catch (error) {
    if (error instanceof RequestAccessError) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof EdpDocumentsEndpointError) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof EdpDocumentError || error instanceof z.ZodError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Erro interno ao processar documento EDP' }, 500);
  }
});
