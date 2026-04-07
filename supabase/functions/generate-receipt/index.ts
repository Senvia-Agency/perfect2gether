import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAYMENT_METHOD_MAP: Record<string, string> = {
  mbway: 'MB',
  transfer: 'TB',
  cash: 'NU',
  card: 'CC',
  check: 'CH',
  other: 'OU',
}

const DEFAULT_KEYINVOICE_API_URL = 'https://login.keyinvoice.com/API5.php'

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

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { sale_id, payment_id, organization_id } = await req.json()
    if (!sale_id || !payment_id || !organization_id) {
      return new Response(JSON.stringify({ error: 'sale_id, payment_id e organization_id são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // Fetch org credentials (including billing_provider and KeyInvoice fields)
    const { data: org } = await supabase
      .from('organizations')
      .select('invoicexpress_account_name, invoicexpress_api_key, integrations_enabled, billing_provider, keyinvoice_password, keyinvoice_api_url, keyinvoice_sid, keyinvoice_sid_expires_at, tax_config')
      .eq('id', organization_id)
      .single()

    const billingProvider = org?.billing_provider || 'invoicexpress'
    const integrationsEnabled = (org?.integrations_enabled as Record<string, boolean> | null) || {}

    // Fetch sale to get invoicexpress_id
    const { data: sale } = await supabase
      .from('sales')
      .select('id, invoicexpress_id, invoice_reference, total_value, client:crm_clients(name, nif, email, phone, address_line1, city, postal_code, country, company, code)')
      .eq('id', sale_id)
      .eq('organization_id', organization_id)
      .single()

    if (!sale) {
      return new Response(JSON.stringify({ error: 'Venda não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!sale.invoicexpress_id) {
      return new Response(JSON.stringify({ error: 'A venda ainda não tem fatura emitida. Emita a fatura primeiro.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch payment
    const { data: payment } = await supabase
      .from('sale_payments')
      .select('*')
      .eq('id', payment_id)
      .eq('sale_id', sale_id)
      .single()

    if (!payment) {
      return new Response(JSON.stringify({ error: 'Pagamento não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (payment.invoice_reference) {
      return new Response(JSON.stringify({ 
        error: 'Recibo já gerado para este pagamento',
        invoice_reference: payment.invoice_reference,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========== KeyInvoice Flow ==========
    if (billingProvider === 'keyinvoice') {
      if (integrationsEnabled.keyinvoice === false || !org?.keyinvoice_password) {
        return new Response(JSON.stringify({ error: 'Integração KeyInvoice não configurada' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sid = await getKeyInvoiceSid(supabase, org, organization_id)
      const apiUrl = org.keyinvoice_api_url || DEFAULT_KEYINVOICE_API_URL

      // Resolve client in KeyInvoice
      const clientData = sale.client as any
      const clientName = clientData?.company || clientData?.name || 'Cliente'
      const clientNif = clientData?.nif
      let keyInvoiceClientId: string | null = null

      if (clientNif) {
        // Try insertClient first
        try {
          const insertClientPayload: Record<string, any> = {
            method: 'insertClient',
            Name: clientName,
            VATIN: clientNif,
            CountryCode: 'PT',
          }
          if (clientData?.email) insertClientPayload.Email = clientData.email
          if (clientData?.phone) insertClientPayload.Phone = clientData.phone
          if (clientData?.address_line1) insertClientPayload.Address = clientData.address_line1
          if (clientData?.city) insertClientPayload.Locality = clientData.city
          if (clientData?.postal_code) insertClientPayload.PostalCode = clientData.postal_code

          const clientRes = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Sid': sid },
            body: JSON.stringify(insertClientPayload),
          })
          if (clientRes.ok) {
            const cData = await clientRes.json()
            if (cData.Status === 1 && cData.Data?.Id) {
              keyInvoiceClientId = String(cData.Data.Id)
            }
          }
        } catch (e) {
          console.warn('KeyInvoice insertClient failed (non-blocking):', e)
        }

        // Fallback: search by VATIN
        if (!keyInvoiceClientId) {
          try {
            const listRes = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Sid': sid },
              body: JSON.stringify({ method: 'listClients' }),
            })
            const listData = await listRes.json()
            if (listData.Status === 1 && listData.Data?.Clients) {
              const clients = Array.isArray(listData.Data.Clients) ? listData.Data.Clients : []
              const match = clients.find((c: any) => c.VATIN === clientNif)
              if (match?.IdClient) keyInvoiceClientId = String(match.IdClient)
            }
          } catch (e) {
            console.warn('KeyInvoice listClients failed:', e)
          }
        }
      }

      // Fetch the original invoice from invoices table to get DocType/DocSeries/DocNum
      const { data: invoiceRecord } = await supabase
        .from('invoices')
        .select('invoicexpress_id, raw_data')
        .eq('sale_id', sale_id)
        .eq('organization_id', organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!invoiceRecord || !invoiceRecord.raw_data) {
        return new Response(JSON.stringify({ error: 'Fatura não encontrada na base de dados. Emita a fatura primeiro.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const rawData = invoiceRecord.raw_data as Record<string, any>
      const invoiceDocType = rawData.docType || rawData.DocType
      const invoiceDocSeries = rawData.docSeries || rawData.DocSeries
      const invoiceDocNum = rawData.docNum || rawData.DocNum

      if (!invoiceDocType || !invoiceDocNum) {
        return new Response(JSON.stringify({ error: 'Dados da fatura incompletos (DocType/DocNum). Não é possível gerar recibo.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Build insertReceipt payload
      const receiptPayload: Record<string, any> = {
        method: 'insertReceipt',
        DocLines: [{
          DocType: String(invoiceDocType),
          DocSeries: String(invoiceDocSeries || ''),
          DocNum: String(invoiceDocNum),
          SettleValue: String(Number(payment.amount)),
        }],
      }

      if (keyInvoiceClientId) {
        receiptPayload.IdClient = keyInvoiceClientId
      } else {
        // Consumidor final - fill client data inline
        receiptPayload.Name = clientName
        if (clientData?.address_line1) receiptPayload.Address = clientData.address_line1
        if (clientData?.postal_code) receiptPayload.PostalCode = clientData.postal_code
        if (clientData?.city) receiptPayload.Locality = clientData.city
        receiptPayload.CountryCode = 'PT'
      }

      console.log('KeyInvoice insertReceipt payload:', JSON.stringify(receiptPayload).substring(0, 2000))

      const createRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Sid': sid },
        body: JSON.stringify(receiptPayload),
      })

      if (!createRes.ok) {
        const errorText = await createRes.text()
        console.error('KeyInvoice insertReceipt HTTP error:', createRes.status, errorText)
        return new Response(JSON.stringify({ error: `Erro ao criar recibo no KeyInvoice: ${createRes.status}`, details: errorText }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const createData = await createRes.json()
      console.log('KeyInvoice insertReceipt response:', JSON.stringify(createData).substring(0, 2000))

      if (createData.Status !== 1 || !createData.Data) {
        return new Response(JSON.stringify({ error: `KeyInvoice: ${createData.ErrorMessage || 'Erro ao criar recibo'}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const rcDocType = createData.Data.DocType
      const rcDocSeries = createData.Data.DocSeries
      const rcDocNum = createData.Data.DocNum
      const fullDocNumber = createData.Data.FullDocNumber || `RC ${rcDocNum}`
      const receiptReference = fullDocNumber

      // Get PDF using the receipt's DocType
      let storedPdfPath: string | null = null
      try {
        const pdfPayload: Record<string, string> = {
          method: 'getDocumentPDF',
          DocType: String(rcDocType),
          DocNum: String(rcDocNum),
        }
        if (rcDocSeries) pdfPayload.DocSeries = String(rcDocSeries)

        const pdfRes = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Sid': sid },
          body: JSON.stringify(pdfPayload),
        })

        if (pdfRes.ok) {
          const pdfData = await pdfRes.json()
          if (pdfData.Status === 1 && pdfData.Data) {
            let base64Pdf = ''
            if (typeof pdfData.Data === 'string') {
              base64Pdf = pdfData.Data
            } else if (typeof pdfData.Data === 'object' && pdfData.Data !== null) {
              const knownKeys = ['PDF', 'pdf', 'Content', 'content', 'File', 'file', 'Base64', 'base64', 'FileContent', 'Document', 'document', 'PDFContent']
              for (const key of knownKeys) {
                if (pdfData.Data[key] && typeof pdfData.Data[key] === 'string') {
                  base64Pdf = pdfData.Data[key]; break
                }
              }
              if (!base64Pdf) {
                for (const [, val] of Object.entries(pdfData.Data)) {
                  if (typeof val === 'string' && (val as string).length > 100) {
                    base64Pdf = val as string; break
                  }
                }
              }
            }

            if (base64Pdf) {
              base64Pdf = base64Pdf.replace(/^data:[^;]+;base64,/, '')
              const binaryStr = atob(base64Pdf)
              const bytes = new Uint8Array(binaryStr.length)
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

              const pdfFileName = `${organization_id}/${sale_id}/RC-${rcDocNum}.pdf`
              const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(pdfFileName, bytes.buffer, { contentType: 'application/pdf', upsert: true })
              if (!uploadError) storedPdfPath = pdfFileName
            }
          }
        }
      } catch (e) {
        console.warn('KeyInvoice receipt PDF failed (non-blocking):', e)
      }

      // Insert receipt record into invoices table
      const clientData = sale.client as any
      const clientName = clientData?.company || clientData?.name || 'Cliente'
      const today = new Date().toISOString().split('T')[0]

      const { data: receiptInvoiceRecord, error: insertError } = await supabase
        .from('invoices')
        .insert({
          organization_id,
          sale_id,
          invoicexpress_id: 0, // placeholder, will update below
          document_type: 'receipt',
          reference: receiptReference,
          total: Number(payment.amount),
          status: 'final',
          date: today,
          raw_data: { source: 'keyinvoice', docType: rcDocType, docSeries: rcDocSeries, docNum: rcDocNum },
          client_name: clientName,
          pdf_path: storedPdfPath || null,
          payment_id: payment_id,
        })
        .select('id')
        .single()

      let receiptInvoiceId: string | null = null
      if (!insertError && receiptInvoiceRecord) {
        receiptInvoiceId = receiptInvoiceRecord.id
        // Update invoicexpress_id to a unique number derived from UUID to avoid collisions
        // Use a negative hash to never collide with real KeyInvoice DocNums
        const hashNum = Math.abs(receiptInvoiceRecord.id.split('').reduce((a: number, c: string) => ((a << 5) - a) + c.charCodeAt(0), 0))
        await supabase
          .from('invoices')
          .update({ invoicexpress_id: hashNum })
          .eq('id', receiptInvoiceRecord.id)
      } else {
        console.warn('Failed to insert receipt into invoices table:', insertError)
      }

      // Update sale_payments - use the invoices table UUID-derived ID to avoid collision
      const paymentInvoicexpressId = receiptInvoiceId
        ? Math.abs(receiptInvoiceId.split('').reduce((a: number, c: string) => ((a << 5) - a) + c.charCodeAt(0), 0))
        : (rcDocNum || null)

      await supabase
        .from('sale_payments')
        .update({
          invoice_reference: receiptReference,
          invoicexpress_id: paymentInvoicexpressId,
          status: 'paid',
          ...(storedPdfPath ? { invoice_file_url: storedPdfPath } : {}),
        })
        .eq('id', payment_id)

      return new Response(JSON.stringify({
        success: true,
        receipt_id: paymentInvoicexpressId,
        invoice_reference: receiptReference,
        ...(storedPdfPath ? { pdf_path: storedPdfPath } : {}),
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========== InvoiceXpress Flow (existing) ==========
    if (integrationsEnabled.invoicexpress === false || !org?.invoicexpress_account_name || !org?.invoicexpress_api_key) {
      return new Response(JSON.stringify({ error: 'Integração InvoiceXpress não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Format payment_date as dd/mm/yyyy
    const paymentDate = new Date(payment.payment_date)
    const formattedDate = `${String(paymentDate.getDate()).padStart(2, '0')}/${String(paymentDate.getMonth() + 1).padStart(2, '0')}/${paymentDate.getFullYear()}`

    const paymentMechanism = PAYMENT_METHOD_MAP[payment.payment_method || 'other'] || 'OU'

    const accountName = org.invoicexpress_account_name
    const apiKey = org.invoicexpress_api_key
    const baseUrl = `https://${accountName}.app.invoicexpress.com`
    const invoiceId = sale.invoicexpress_id

    // Call partial_payments endpoint
    const partialPaymentPayload = {
      partial_payment: {
        payment_mechanism: paymentMechanism,
        amount: Number(payment.amount),
        payment_date: formattedDate,
        note: payment.notes || `Pagamento - ${payment.payment_method ? payment.payment_method.toUpperCase() : ''}`,
      },
    }

    console.log('Calling partial_payments:', JSON.stringify(partialPaymentPayload))

    const receiptRes = await fetch(
      `${baseUrl}/documents/${invoiceId}/partial_payments.json?api_key=${apiKey}`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(partialPaymentPayload),
      }
    )

    if (!receiptRes.ok) {
      const errorText = await receiptRes.text()
      console.error('InvoiceXpress partial_payment error:', receiptRes.status, errorText)
      return new Response(JSON.stringify({ 
        error: `Erro ao gerar recibo no InvoiceXpress: ${receiptRes.status}`, 
        details: errorText,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const receiptData = await receiptRes.json()
    const receipt = receiptData.receipt || {}
    const receiptId = receipt.id
    const receiptSeqNumber = receipt.inverted_sequence_number || receipt.sequence_number
    const receiptPermalink = receipt.permalink || null

    const receiptReference = receiptSeqNumber ? `RC ${receiptSeqNumber}` : `RC #${receiptId}`

    // Try to get PDF
    let pdfUrl: string | null = null
    if (receiptId) {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const pdfRes = await fetch(`${baseUrl}/api/pdf/${receiptId}.json?api_key=${apiKey}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          })
          if (pdfRes.status === 200) {
            const pdfData = await pdfRes.json()
            pdfUrl = pdfData?.output?.pdfUrl || null
            if (pdfUrl) break
          }
          await new Promise(r => setTimeout(r, 2000))
        }
      } catch (e) {
        console.warn('PDF polling failed (non-blocking):', e)
      }
    }

    // QR Code polling for receipt
    let qrCodeUrl: string | null = null
    if (receiptId) {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const qrRes = await fetch(`${baseUrl}/api/qr_codes/${receiptId}.json?api_key=${apiKey}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          })
          if (qrRes.status === 200) {
            const qrData = await qrRes.json()
            qrCodeUrl = qrData?.qr_code?.url || null
            if (qrCodeUrl) break
          }
          await new Promise(r => setTimeout(r, 2000))
        }
      } catch (e) {
        console.warn('QR Code polling failed (non-blocking):', e)
      }
    }

    // Save receipt reference in sale_payment
    const fileUrl = pdfUrl || receiptPermalink || null
    await supabase
      .from('sale_payments')
      .update({
        invoice_reference: receiptReference,
        invoicexpress_id: receiptId || null,
        status: 'paid',
        ...(fileUrl ? { invoice_file_url: fileUrl } : {}),
        ...(qrCodeUrl ? { qr_code_url: qrCodeUrl } : {}),
      })
      .eq('id', payment_id)

    return new Response(JSON.stringify({
      success: true,
      receipt_id: receiptId,
      invoice_reference: receiptReference,
      ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
      ...(qrCodeUrl ? { qr_code_url: qrCodeUrl } : {}),
    }), {
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
