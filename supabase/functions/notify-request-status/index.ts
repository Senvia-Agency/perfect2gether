import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  expense: "Despesa",
  vacation: "Férias",
  invoice: "Fatura",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Aprovado",
  rejected: "Rejeitado",
  paid: "Pago",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "#16a34a",
  rejected: "#dc2626",
  paid: "#15803d",
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

    const { request_id, organization_id, new_status, review_notes } = await req.json();
    if (!request_id || !organization_id || !new_status) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get request details
    const { data: request, error: reqError } = await adminClient
      .from("internal_requests")
      .select("submitted_by, title, request_type")
      .eq("id", request_id)
      .single();

    if (reqError || !request) {
      console.error("Request not found:", reqError);
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get submitter email from auth.users
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(request.submitted_by);
    if (userError || !userData?.user?.email) {
      console.error("User not found:", userError);
      return new Response(JSON.stringify({ skipped: true, reason: "No user email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org settings (Brevo credentials)
    const { data: org } = await adminClient
      .from("organizations")
      .select("brevo_api_key, brevo_sender_email, name")
      .eq("id", organization_id)
      .single();

    if (!org?.brevo_api_key || !org?.brevo_sender_email) {
      return new Response(JSON.stringify({ skipped: true, reason: "No Brevo config" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusLabel = STATUS_LABELS[new_status] || new_status;
    const statusColor = STATUS_COLORS[new_status] || "#333";
    const typeLabel = REQUEST_TYPE_LABELS[request.request_type] || request.request_type;

    const notesHtml = review_notes
      ? `<tr>
           <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Notas</td>
           <td style="padding: 8px; border-bottom: 1px solid #eee;">${review_notes}</td>
         </tr>`
      : "";

    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": org.brevo_api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: org.brevo_sender_email, name: org.name || "Senvia" },
        to: [{ email: userData.user.email }],
        subject: `Pedido ${statusLabel}: ${request.title}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Atualização do Pedido Interno</h2>
            <p>O seu pedido foi atualizado com o seguinte estado:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="display: inline-block; padding: 8px 24px; border-radius: 6px; background-color: ${statusColor}; color: #fff; font-size: 18px; font-weight: bold;">
                ${statusLabel}
              </span>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Título</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${request.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Tipo</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${typeLabel}</td>
              </tr>
              ${notesHtml}
            </table>
            <p style="color: #666; font-size: 14px;">Aceda à plataforma para mais detalhes.</p>
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
