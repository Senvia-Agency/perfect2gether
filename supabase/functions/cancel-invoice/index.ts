import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_KEYINVOICE_API_URL = 'https://login.keyinvoice.com/API5.php'

const KI_DOC_TYPE_MAP: Record<string, string> = {
  invoice: '4',
  invoice_receipt: '20',
  receipt: '6',
  credit_note: '8',
}

// API 5.0: Authenticate with Apikey header, get session Sid, cache it
async function getKeyInvoiceSid(supabase: any, org: any, orgId: string): Promise<string> {
  if (!org.keyinvoice_password) {
    throw new Error('Chave da API KeyInvoice não configurada')
  }

  const now = new Date()
  const margin = 5 * 60 * 1000
  if (org.keyinvoice_sid && org.keyinvoice_sid_expires_at) {
    const expiresAt = new Date(org.keyinvoice_sid_expires_at)
    if (expiresAt.getTime() > now.getTime() + margin) {
      return org.keyinvoice_sid
    }
  }

  const apiUrl = org.keyinvoice_api_url || DEFAULT_KEYINVOICE_API_URL
  const authRes = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Apikey': org.keyinvoice_password },
    body: JSON.stringify({ method: 'authenticate' }),
  })

  if (!authRes.ok) {
    const errorText = await authRes.text()
    throw new Error(`Erro ao autenticar no KeyInvoice: ${authRes.status} - ${errorText}`)
  }

  const authData = await authRes.json()
  if (authData.Status !== 1 || !authData.Sid) {
    throw new Error(`KeyInvoice auth: ${authData.ErrorMessage || 'Erro de autenticação'}`)
  }

  const newSid = authData.Sid
  const expiresAt = new Date(now.getTime() + 3600 * 1000)

  await supabase
    .from('organizations')
    .update({ keyinvoice_sid: newSid, keyinvoice_sid_expires_at: expiresAt.toISOString() })
    .eq('id', orgId)

  return newSid
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { payment_id, sale_id, organization_id, reason, invoicexpress_id, document_type } = await req.json()

    if (!organization_id || !reason || !invoicexpress_id || !document_type) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: organization_id, reason, invoicexpress_id, document_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!payment_id && !sale_id) {
      return new Response(JSON.stringify({ error: 'payment_id ou sale_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Sem acesso a esta organização' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch org credentials
    const { data: org } = await supabase
      .from('organizations')
      .select('invoicexpress_account_name, invoicexpress_api_key, billing_provider, keyinvoice_password, keyinvoice_api_url, keyinvoice_sid, keyinvoice_sid_expires_at')
      .eq('id', organization_id)
      .single()

    const billingProvider = (org as any)?.billing_provider || 'invoicexpress'

    if (billingProvider === 'keyinvoice') {
      // KeyInvoice cancel flow using API 5.0: method:"setDocumentVoid"
      if (!org?.keyinvoice_password) {
        return new Response(JSON.stringify({ error: 'Chave da API KeyInvoice não configurada' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sid = await getKeyInvoiceSid(supabase, org, organization_id)
      const apiUrl = org.keyinvoice_api_url || DEFAULT_KEYINVOICE_API_URL
      const docType = KI_DOC_TYPE_MAP[document_type] || '4'

      const voidPayload: Record<string, string> = {
        method: 'setDocumentVoid',
        DocType: docType,
        DocNum: String(invoicexpress_id),
        CreditReason: reason,
      }

      const annulRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Sid': sid },
        body: JSON.stringify(voidPayload),
      })

      if (!annulRes.ok) {
        const errorText = await annulRes.text()
        console.error('KeyInvoice setDocumentVoid HTTP error:', annulRes.status, errorText)
        return new Response(JSON.stringify({ error: `Erro ao anular documento no KeyInvoice (${annulRes.status})`, details: errorText }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const annulData = await annulRes.json()
      if (annulData.Status !== 1) {
        console.error('KeyInvoice setDocumentVoid failed:', annulData.ErrorMessage)
        return new Response(JSON.stringify({ error: `KeyInvoice: ${annulData.ErrorMessage || 'Erro ao anular'}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // annulData.Data may contain {Voided,Message} or {DocType,DocSeries,DocNum,FullDocNumber} (credit note)
      console.log('KeyInvoice void result:', JSON.stringify(annulData.Data))
    } else {
      // InvoiceXpress cancel flow
      if (!org?.invoicexpress_account_name || !org?.invoicexpress_api_key) {
        return new Response(JSON.stringify({ error: 'Credenciais InvoiceXpress não configuradas' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const endpointMap: Record<string, string> = { invoice: 'invoices', invoice_receipt: 'invoice_receipts', receipt: 'receipts' }
      const docKeyMap: Record<string, string> = { invoice: 'invoice', invoice_receipt: 'invoice_receipt', receipt: 'receipt' }
      const endpointName = endpointMap[document_type] || 'invoices'
      const docKey = docKeyMap[document_type] || 'invoice'
      const baseUrl = `https://${org.invoicexpress_account_name}.app.invoicexpress.com`

      const cancelRes = await fetch(
        `${baseUrl}/${endpointName}/${invoicexpress_id}/change-state.json?api_key=${org.invoicexpress_api_key}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ [docKey]: { state: 'canceled', message: reason } }),
        }
      )

      if (!cancelRes.ok) {
        const errorText = await cancelRes.text()
        console.error('InvoiceXpress cancel error:', cancelRes.status, errorText)
        return new Response(JSON.stringify({ error: `Erro ao anular fatura no InvoiceXpress (${cancelRes.status})`, details: errorText }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      try { await cancelRes.text() } catch {}
    }

    // Update invoice status in invoices table
    await supabase
      .from('invoices')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('organization_id', organization_id)
      .eq('invoicexpress_id', invoicexpress_id)

    // Clear references
    if (payment_id) {
      await supabase
        .from('sale_payments')
        .update({
          invoice_reference: null,
          invoice_file_url: null,
          invoicexpress_id: null,
        })
        .eq('id', payment_id)
    }
    
    if (sale_id) {
      await supabase
        .from('sales')
        .update({
          invoicexpress_id: null,
          invoicexpress_type: null,
          invoice_reference: null,
        })
        .eq('id', sale_id)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
