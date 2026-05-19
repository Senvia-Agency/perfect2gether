import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { organizationId, recipientEmail, recipientName, redirectTo } = await req.json();
    if (!organizationId || !recipientEmail || !recipientName) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios em falta' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Generate recovery link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: recipientEmail,
      options: { redirectTo: redirectTo || `${supabaseUrl}/reset-password` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Error generating recovery link:', linkError);
      return new Response(JSON.stringify({ error: 'Erro ao gerar link de recuperação' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const recoveryLink = linkData.properties.action_link;

    // Get org Brevo config
    const { data: org } = await adminClient
      .from('organizations')
      .select('brevo_api_key, brevo_sender_email, name')
      .eq('id', organizationId)
      .single();

    const brevoApiKey = org?.brevo_api_key || Deno.env.get('BREVO_API_KEY');
    const senderEmail = org?.brevo_sender_email || 'noreply@perfect2gether.pt';
    const orgName = org?.name || 'Perfect2Gether';

    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: 'API Key do Brevo não configurada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:#18181b;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${orgName}</h1>
            <p style="margin:8px 0 0;color:#a1a1aa;font-size:14px;">Recuperação de Palavra-passe</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;color:#27272a;font-size:15px;line-height:1.6;">Olá <strong>${recipientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.6;">
              Foi solicitada a recuperação da sua palavra-passe no sistema <strong>${orgName}</strong>. Clique no botão abaixo para definir uma nova palavra-passe:
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${recoveryLink}" style="display:inline-block;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;">
                    Redefinir Palavra-passe
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;line-height:1.5;">
              Este link expira em 24 horas. Se não solicitou esta ação, ignore este email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
            <p style="margin:0;color:#a1a1aa;font-size:11px;">Este email foi enviado automaticamente por ${orgName}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: senderEmail, name: orgName },
        to: [{ email: recipientEmail, name: recipientName }],
        subject: `${orgName} — Recuperação de Palavra-passe`,
        htmlContent,
      }),
    });

    if (!brevoRes.ok) {
      const errBody = await brevoRes.text();
      console.error('Brevo error:', brevoRes.status, errBody);
      return new Response(JSON.stringify({ error: `Erro Brevo: ${brevoRes.status}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
