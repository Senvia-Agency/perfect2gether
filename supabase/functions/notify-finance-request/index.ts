import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  expense_reimbursement: "Reembolso de Despesa",
  supplier_invoice: "Fatura de Fornecedor",
  vacation_map: "Mapa de Férias",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { organization_id, title, request_type } = await req.json();
    if (!organization_id || !title) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org settings
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: org } = await adminClient
      .from("organizations")
      .select("finance_email, brevo_api_key, brevo_sender_email, name")
      .eq("id", organization_id)
      .single();

    if (!org?.finance_email || !org?.brevo_api_key || !org?.brevo_sender_email) {
      return new Response(JSON.stringify({ skipped: true, reason: "No finance email or Brevo config" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get submitter name
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const submitterName = profile?.full_name || "Colaborador";
    const typeLabel = REQUEST_TYPE_LABELS[request_type] || request_type;

    // Send email via Brevo
    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": org.brevo_api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: org.brevo_sender_email, name: org.name || "Senvia" },
        to: [{ email: org.finance_email }],
        subject: `Novo Pedido Interno: ${title}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Novo Pedido Interno</h2>
            <p>Foi submetido um novo pedido interno que requer a sua atenção.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Título</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${title}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Tipo</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${typeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Submetido por</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${submitterName}</td>
              </tr>
            </table>
            <p style="color: #666; font-size: 14px;">Aceda à plataforma para validar e processar este pedido.</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Brevo error:", errText);
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
