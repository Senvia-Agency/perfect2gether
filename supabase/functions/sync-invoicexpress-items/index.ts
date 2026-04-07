import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
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

    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
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

    // Get InvoiceXpress credentials
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("invoicexpress_api_key, invoicexpress_account_name")
      .eq("id", organization_id)
      .single();

    if (orgError || !org?.invoicexpress_api_key || !org?.invoicexpress_account_name) {
      return new Response(
        JSON.stringify({ error: "Credenciais InvoiceXpress não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invoicexpress_api_key, invoicexpress_account_name } = org;
    const baseUrl = `https://${invoicexpress_account_name}.app.invoicexpress.com`;

    // Fetch all items from InvoiceXpress (paginated)
    const allItems: any[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${baseUrl}/items.json?page=${page}&per_page=30&api_key=${invoicexpress_api_key}`;
      const res = await fetch(url, {
        headers: { accept: "application/json" },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`InvoiceXpress API error page ${page}:`, errorText);
        return new Response(
          JSON.stringify({ error: `Erro ao buscar itens do InvoiceXpress (página ${page})` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      const items = data.items || [];
      allItems.push(...items);

      if (data.pagination) {
        totalPages = data.pagination.total_pages || 1;
      }
      page++;
    }

    // Get existing products with invoicexpress_id
    const { data: existingProducts } = await supabase
      .from("products")
      .select("id, invoicexpress_id")
      .eq("organization_id", organization_id)
      .not("invoicexpress_id", "is", null);

    const existingMap = new Map<number, string>();
    (existingProducts || []).forEach((p: any) => {
      if (p.invoicexpress_id != null) {
        existingMap.set(p.invoicexpress_id, p.id);
      }
    });

    let created = 0;
    let updated = 0;

    for (const item of allItems) {
      const taxValue = item.tax?.value ?? null;
      const productData = {
        name: item.name,
        description: item.description || null,
        price: item.unit_price != null ? Number(item.unit_price) : null,
        tax_value: taxValue != null ? Number(taxValue) : null,
      };

      const existingId = existingMap.get(item.id);

      if (existingId) {
        // Update existing
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", existingId);
        if (!error) updated++;
      } else {
        // Create new
        const { error } = await supabase.from("products").insert({
          ...productData,
          invoicexpress_id: item.id,
          organization_id,
          is_active: true,
          is_recurring: false,
        });
        if (!error) created++;
      }
    }

    return new Response(
      JSON.stringify({ created, updated, total: allItems.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao sincronizar" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
