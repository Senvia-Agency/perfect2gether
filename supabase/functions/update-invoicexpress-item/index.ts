import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function mapTaxValue(taxValue: number | null): { name: string; value: number } | null {
  if (taxValue === null || taxValue === undefined) return null;
  const map: Record<number, string> = { 23: "IVA23", 13: "IVA13", 6: "IVA6", 0: "Isento" };
  return { name: map[taxValue] ?? "IVA23", value: taxValue };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, invoicexpress_id, name, description, unit_price, tax_value } = await req.json();

    if (!organization_id || !invoicexpress_id) {
      return new Response(JSON.stringify({ error: "organization_id e invoicexpress_id obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await supabase.rpc("is_org_member", {
      _user_id: user.id,
      _org_id: organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Sem acesso à organização" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("invoicexpress_api_key, invoicexpress_account_name")
      .eq("id", organization_id)
      .single();

    if (!org?.invoicexpress_api_key || !org?.invoicexpress_account_name) {
      return new Response(
        JSON.stringify({ error: "Credenciais InvoiceXpress não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const itemBody: Record<string, unknown> = {};
    if (name !== undefined) itemBody.name = name;
    if (description !== undefined) itemBody.description = description || "";
    if (unit_price !== undefined) itemBody.unit_price = unit_price;

    const tax = mapTaxValue(tax_value);
    if (tax) itemBody.tax = tax;

    const url = `https://${org.invoicexpress_account_name}.app.invoicexpress.com/items/${invoicexpress_id}.json?api_key=${org.invoicexpress_api_key}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ item: itemBody }),
    });

    if (res.status === 404) {
      return new Response(
        JSON.stringify({ warning: "Item não encontrado no InvoiceXpress (pode ter sido eliminado)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error("InvoiceXpress PUT error:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar item no InvoiceXpress" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Update item error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
