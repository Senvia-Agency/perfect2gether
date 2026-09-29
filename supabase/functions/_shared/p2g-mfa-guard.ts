import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function p2gMfaGate(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!token || token === anonKey || token === serviceKey) return null;

  if (!url || !anonKey) {
    return Response.json(
      { error: 'Serviço de autenticação indisponível' },
      { status: 503, headers: corsHeaders },
    );
  }

  try {
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc('p2g_mfa_ok');
    if (!error && data === true) return null;
    if (!error || error.code === '42501') {
      return Response.json(
        { error: 'Confirme a autenticação de dois fatores para continuar.' },
        { status: 403, headers: corsHeaders },
      );
    }
  } catch {
    return Response.json(
      { error: 'Serviço de autenticação indisponível' },
      { status: 503, headers: corsHeaders },
    );
  }

  return Response.json(
    { error: 'Serviço de autenticação indisponível' },
    { status: 503, headers: corsHeaders },
  );
}
