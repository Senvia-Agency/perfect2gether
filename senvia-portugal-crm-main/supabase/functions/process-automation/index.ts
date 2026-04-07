import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationEvent {
  trigger_type: string;
  organization_id: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { trigger_type, organization_id, record, old_record }: AutomationEvent = await req.json();

    if (!trigger_type || !organization_id || !record) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing automation: ${trigger_type} for org ${organization_id}`);

    // Check if organization has Brevo configured - automations only work with Brevo
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("brevo_api_key")
      .eq("id", organization_id)
      .single();

    if (orgError || !orgData?.brevo_api_key) {
      console.log(`Organization ${organization_id} has no Brevo API key configured, skipping automations`);
      return new Response(
        JSON.stringify({ message: "Organization has no Brevo configured, skipping automations" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find templates with automation enabled for this trigger
    const { data: templates, error: tplError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("automation_enabled", true)
      .eq("automation_trigger_type", trigger_type)
      .eq("is_active", true);

    if (tplError) {
      console.error("Error fetching templates:", tplError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch templates" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active automation templates for this trigger" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve recipient - direct fields or via client_id lookup
    let recipientEmail = (record.email as string) || '';
    let recipientName = (record.name as string) || '';
    let recipientCompany = '';
    const clientId = (record.client_id as string) || null;

    if (!recipientEmail && clientId) {
      console.log(`No direct email, looking up client_id: ${clientId}`);
      const { data: client } = await supabase
        .from('crm_clients')
        .select('email, name, company')
        .eq('id', clientId)
        .single();

      if (client) {
        recipientEmail = client.email || '';
        recipientName = client.name || '';
        recipientCompany = client.company || '';
        console.log(`Resolved client: ${recipientName} <${recipientEmail}> company=${recipientCompany}`);
      }
    }

    if (!recipientEmail) {
      console.warn(`No email found in trigger record for ${trigger_type}`);
      return new Response(
        JSON.stringify({ message: "No recipient email in record" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let triggered = 0;

    for (const template of templates) {
      // Check trigger_config conditions
      const config = (template.automation_trigger_config as Record<string, unknown>) || {};
      if (!matchesTriggerConfig(config, record, old_record)) {
        continue;
      }

      // Build variables from trigger record
      // Use activation_date/sale_date from record for {{data}} instead of today
      const formatDatePT = (dateStr: string | unknown): string => {
        if (!dateStr || typeof dateStr !== 'string') return '';
        try {
          return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
        } catch { return ''; }
      };

      const activationDate = formatDatePT(record.activation_date);
      const saleDate = formatDatePT(record.sale_date);

      const variables: Record<string, string> = {
        nome: recipientName,
        email: recipientEmail,
        empresa: recipientCompany || (record.company as string) || '',
        data: new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }),
        data_ativacao: activationDate,
        data_venda: saleDate,
      };
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'string' || typeof value === 'number') {
          variables[key] = String(value);
        }
      }

      const delayMinutes = template.automation_delay_minutes || 0;

      if (delayMinutes > 0) {
        const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
        await supabase.from("automation_queue").insert({
          automation_id: template.id,
          organization_id,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          variables: {
            ...variables,
            client_id: clientId || '',
          },
          template_id: template.id,
          scheduled_for: scheduledFor.toISOString(),
          status: "pending",
        });
        console.log(`Queued template ${template.id} for ${recipientEmail} at ${scheduledFor.toISOString()}`);
      } else {
        const { error: sendError } = await supabase.functions.invoke("send-template-email", {
          body: {
            organizationId: organization_id,
            templateId: template.id,
            recipients: [{
              email: recipientEmail,
              name: recipientName,
              clientId: clientId,
              variables,
            }],
          },
        });

        if (sendError) {
          console.error(`Failed to send template ${template.id} to ${recipientEmail}:`, sendError);
        } else {
          console.log(`Sent template ${template.id} to ${recipientEmail}`);
        }
      }

      triggered++;
    }

    return new Response(
      JSON.stringify({ success: true, triggered }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-automation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function matchesTriggerConfig(
  config: Record<string, unknown> | null,
  record: Record<string, unknown>,
  oldRecord?: Record<string, unknown>
): boolean {
  if (!config || Object.keys(config).length === 0) return true;
  if (config.to_status && record.status !== config.to_status) return false;
  if (config.from_status && oldRecord && oldRecord.status !== config.from_status) return false;
  return true;
}
