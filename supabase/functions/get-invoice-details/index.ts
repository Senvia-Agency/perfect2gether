import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function fetchKeyInvoicePdf(
  supabase: any,
  org: any,
  orgId: string,
  invoiceRecord: any
): Promise<{ storagePath: string | null; signedUrl: string | null }> {
  try {
    // Parse reference "34 47/1" -> DocType=34, DocSeries=47, DocNum=1
    let docType: string | null = null
    let docSeries: string | null = null
    let docNum: string | null = null

    // Try raw_data first
    const raw = invoiceRecord.raw_data
    if (raw?.docType) docType = String(raw.docType)
    if (raw?.docNum) docNum = String(raw.docNum)
    if (raw?.docSeries) docSeries = String(raw.docSeries)

    // Fallback: parse reference
    if (!docType || !docNum) {
      const match = invoiceRecord.reference?.match(/^(\d+)\s+(\d+)\/(\d+)$/)
      if (match) {
        docType = match[1]
        docSeries = match[2]
        docNum = match[3]
      }
    }

    if (!docType || !docNum) {
      console.warn('KeyInvoice PDF: Cannot parse reference:', invoiceRecord.reference)
      return { storagePath: null, signedUrl: null }
    }

    const sid = await getKeyInvoiceSid(supabase, org, orgId)
    const apiUrl = org.keyinvoice_api_url || DEFAULT_KEYINVOICE_API_URL

    const pdfPayload: Record<string, string> = {
      method: 'getDocumentPDF',
      DocType: docType,
      DocNum: docNum,
    }
    if (docSeries) pdfPayload.DocSeries = docSeries

    console.log('KeyInvoice getDocumentPDF payload:', JSON.stringify(pdfPayload))

    const pdfRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Sid': sid },
      body: JSON.stringify(pdfPayload),
    })

    if (!pdfRes.ok) {
      console.warn('KeyInvoice getDocumentPDF HTTP error:', pdfRes.status)
      return { storagePath: null, signedUrl: null }
    }

    const pdfData = await pdfRes.json()
    console.log('KeyInvoice getDocumentPDF response Status:', pdfData.Status,
      'Data type:', typeof pdfData.Data,
      typeof pdfData.Data === 'object' && pdfData.Data !== null ? 'keys: ' + JSON.stringify(Object.keys(pdfData.Data)) : '')

    if (pdfData.Status !== 1 || !pdfData.Data) {
      console.warn('KeyInvoice getDocumentPDF failed:', pdfData.ErrorMessage)
      return { storagePath: null, signedUrl: null }
    }

    let base64Pdf = ''
    if (typeof pdfData.Data === 'string') {
      base64Pdf = pdfData.Data
    } else if (typeof pdfData.Data === 'object' && pdfData.Data !== null) {
      const knownKeys = ['PDF', 'pdf', 'Content', 'content', 'File', 'file',
                         'Base64', 'base64', 'FileContent', 'Document', 'document', 'PDFContent']
      for (const key of knownKeys) {
        if (pdfData.Data[key] && typeof pdfData.Data[key] === 'string') {
          console.log('KeyInvoice PDF: Found key:', key)
          base64Pdf = pdfData.Data[key]
          break
        }
      }
      if (!base64Pdf) {
        for (const [key, val] of Object.entries(pdfData.Data)) {
          if (typeof val === 'string' && (val as string).length > 100) {
            console.log('KeyInvoice PDF: Using fallback key:', key)
            base64Pdf = val as string
            break
          }
        }
      }
    }

    if (base64Pdf) {
      base64Pdf = base64Pdf.replace(/^data:[^;]+;base64,/, '')
    }

    if (!base64Pdf) {
      console.warn('KeyInvoice: Could not extract base64 PDF. Data keys:', 
        typeof pdfData.Data === 'object' ? JSON.stringify(Object.keys(pdfData.Data)) : typeof pdfData.Data)
      return { storagePath: null, signedUrl: null }
    }

    const binaryStr = atob(base64Pdf)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const docTypeCode = docType === '34' ? 'FR' : 'FT'
    const pdfFileName = `${orgId}/keyinvoice_${docTypeCode}-${docSeries || '0'}-${docNum}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(pdfFileName, bytes.buffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('KeyInvoice PDF upload error:', uploadError)
      return { storagePath: null, signedUrl: null }
    }

    // Update invoices table with pdf_path
    await supabase
      .from('invoices')
      .update({ pdf_path: pdfFileName })
      .eq('id', invoiceRecord.id)

    // Generate signed URL
    const { data: signedData } = await supabase.storage
      .from('invoices')
      .createSignedUrl(pdfFileName, 3600)

    console.log('KeyInvoice PDF stored successfully:', pdfFileName)
    return { storagePath: pdfFileName, signedUrl: signedData?.signedUrl || null }
  } catch (e) {
    console.error('KeyInvoice PDF fetch error:', e)
    return { storagePath: null, signedUrl: null }
  }
}

const TYPE_MAP: Record<string, { endpoint: string; responseKey: string }> = {
  invoice: { endpoint: 'invoices', responseKey: 'invoice' },
  invoice_receipt: { endpoint: 'invoice_receipts', responseKey: 'invoice_receipt' },
  receipt: { endpoint: 'receipts', responseKey: 'receipt' },
  credit_note: { endpoint: 'credit_notes', responseKey: 'credit_note' },
}

async function pollWithRetry(url: string, extractor: (data: any) => string | null, attempts = 3, delayMs = 2000): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } })
      if (res.status === 200) {
        const data = await res.json()
        const value = extractor(data)
        if (value) return value
      }
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs))
    } catch (e) {
      console.warn(`Poll attempt ${i + 1} failed:`, e)
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs))
    }
  }
  return null
}

async function downloadAndUploadPdf(
  supabase: any,
  pdfUrl: string,
  storagePath: string
): Promise<string | null> {
  try {
    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) {
      console.warn('Failed to download PDF:', pdfRes.status)
      return null
    }
    const pdfBlob = await pdfRes.blob()
    const arrayBuffer = await pdfBlob.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(storagePath, uint8, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return null
    }
    return storagePath
  } catch (e) {
    console.error('Download/upload error:', e)
    return null
  }
}

async function ensurePdfInStorage(
  supabase: any,
  baseUrl: string,
  apiKey: string,
  documentId: number,
  documentType: string,
  organizationId: string
): Promise<{ storagePath: string | null; signedUrl: string | null }> {
  const fileName = `${organizationId}/${documentType}_${documentId}.pdf`

  // Check if PDF already exists in storage
  const { data: existing } = await supabase.storage
    .from('invoices')
    .list(organizationId, { search: `${documentType}_${documentId}.pdf` })

  const fileExists = existing && existing.length > 0 && existing.some((f: any) => f.name === `${documentType}_${documentId}.pdf`)

  if (fileExists) {
    // Generate signed URL
    const { data: signedData } = await supabase.storage
      .from('invoices')
      .createSignedUrl(fileName, 3600) // 1 hour
    return { storagePath: fileName, signedUrl: signedData?.signedUrl || null }
  }

  // PDF doesn't exist - download from InvoiceXpress
  const pdfTempUrl = await pollWithRetry(
    `${baseUrl}/api/pdf/${documentId}.json?api_key=${apiKey}`,
    (data) => data?.output?.pdfUrl || null
  )

  if (!pdfTempUrl) {
    return { storagePath: null, signedUrl: null }
  }

  const storagePath = await downloadAndUploadPdf(supabase, pdfTempUrl, fileName)
  if (!storagePath) {
    return { storagePath: null, signedUrl: null }
  }

  // Generate signed URL
  const { data: signedData } = await supabase.storage
    .from('invoices')
    .createSignedUrl(storagePath, 3600)

  return { storagePath, signedUrl: signedData?.signedUrl || null }
}

function buildTaxSummary(items: any[]): Array<{ name: string; rate: number; incidence: number; value: number }> {
  const taxMap = new Map<string, { name: string; rate: number; incidence: number; value: number }>()
  for (const item of items) {
    if (!item.tax) continue
    const key = `${item.tax.name || 'IVA'}-${item.tax.value || 0}`
    const existing = taxMap.get(key)
    if (existing) {
      existing.incidence += Number(item.subtotal || 0)
      existing.value += Number(item.tax_amount || 0)
    } else {
      taxMap.set(key, {
        name: item.tax.name || 'IVA',
        rate: Number(item.tax.value || 0),
        incidence: Number(item.subtotal || 0),
        value: Number(item.tax_amount || 0),
      })
    }
  }
  return Array.from(taxMap.values())
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { document_id, document_type, organization_id, sync, sale_id, payment_id } = await req.json()

    if (!document_id || !document_type || !organization_id) {
      return new Response(JSON.stringify({ error: 'document_id, document_type e organization_id são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const typeConfig = TYPE_MAP[document_type]
    if (!typeConfig) {
      return new Response(JSON.stringify({ error: `Tipo de documento inválido: ${document_type}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get org credentials
    const { data: org } = await supabase
      .from('organizations')
      .select('invoicexpress_account_name, invoicexpress_api_key, billing_provider, keyinvoice_password, keyinvoice_api_url, keyinvoice_sid, keyinvoice_sid_expires_at')
      .eq('id', organization_id)
      .single()

    // Check if this is a KeyInvoice document - return data from DB instead of calling external API
    const isKeyInvoice = org?.billing_provider === 'keyinvoice'

    // Also check if the invoice record itself has keyinvoice source
    let invoiceRecord: any = null
    if (document_type !== 'credit_note') {
      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('invoicexpress_id', document_id)
        .maybeSingle()
      invoiceRecord = inv
    }

    const isKeyInvoiceDoc = isKeyInvoice || (invoiceRecord?.raw_data?.source === 'keyinvoice')

    if (isKeyInvoiceDoc) {
      // For KeyInvoice documents, return data from the invoices table
      if (!invoiceRecord) {
        return new Response(JSON.stringify({ error: 'Documento não encontrado na base de dados' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get sale details for additional info
      let saleData: any = null
      if (invoiceRecord.sale_id) {
        const { data: sale } = await supabase
          .from('sales')
          .select('*, sale_items(*)')
          .eq('id', invoiceRecord.sale_id)
          .maybeSingle()
        saleData = sale
      }

      // Get client details
      let clientData: any = null
      if (saleData?.client_id) {
        const { data: client } = await supabase
          .from('crm_clients')
          .select('*')
          .eq('id', saleData.client_id)
          .maybeSingle()
        clientData = client
      }

      // Try to fetch PDF from KeyInvoice if not stored yet
      let pdfSignedUrl: string | null = null
      let currentPdfPath = invoiceRecord.pdf_path

      if (!currentPdfPath && org?.keyinvoice_password) {
        console.log('KeyInvoice: PDF not stored, attempting on-demand download for', invoiceRecord.reference)
        const pdfResult = await fetchKeyInvoicePdf(supabase, org, organization_id, invoiceRecord)
        if (pdfResult.storagePath) {
          currentPdfPath = pdfResult.storagePath
          pdfSignedUrl = pdfResult.signedUrl
        }
      }

      if (currentPdfPath && !pdfSignedUrl) {
        const { data: signedData } = await supabase.storage
          .from('invoices')
          .createSignedUrl(currentPdfPath, 3600)
        pdfSignedUrl = signedData?.signedUrl || null
      }

      // For receipts, show payment amount instead of sale items
      // Use document_type from REQUEST (not DB record) to handle legacy receipts
      const isReceipt = document_type === 'receipt'
      let items: any[]
      let displayTotal = invoiceRecord.total

      // If it's a receipt, try to get the actual payment amount
      if (isReceipt && payment_id) {
        const { data: paymentRecord } = await supabase
          .from('sale_payments')
          .select('amount')
          .eq('id', payment_id)
          .maybeSingle()
        if (paymentRecord?.amount) {
          displayTotal = paymentRecord.amount
        }
      }

      if (isReceipt) {
        // Receipt: show a single line with the payment amount
        items = [{
          name: 'Liquidação de pagamento',
          description: invoiceRecord.reference || '',
          unit_price: String(displayTotal),
          quantity: '1',
          tax: null,
          discount: 0,
          subtotal: displayTotal,
          tax_amount: 0,
          total: displayTotal,
        }]
      } else {
        items = (saleData?.sale_items || []).map((item: any) => ({
          name: item.name,
          description: '',
          unit_price: String(item.unit_price),
          quantity: String(item.quantity),
          tax: null,
          discount: 0,
          subtotal: item.total,
          tax_amount: 0,
          total: item.total,
        }))
      }

      const result = {
        id: invoiceRecord.invoicexpress_id,
        status: invoiceRecord.status || 'final',
        sequence_number: invoiceRecord.reference,
        atcud: null,
        date: invoiceRecord.date,
        due_date: invoiceRecord.due_date,
        permalink: null,
        sum: displayTotal,
        discount: 0,
        before_taxes: displayTotal,
        taxes: 0,
        total: displayTotal,
        retention: 0,
        currency: 'EUR',
        tax_exemption: null,
        observations: null,
        mb_reference: null,
        cancel_reason: null,
        qr_code_url: null,
        pdf_url: currentPdfPath,
        pdf_signed_url: pdfSignedUrl,
        owner: null,
        client: clientData ? {
          id: 0,
          name: clientData.name,
          fiscal_id: clientData.nif || '',
          country: clientData.country || 'PT',
          address: clientData.address_line1,
          postal_code: clientData.postal_code,
          city: clientData.city,
          email: clientData.email,
          phone: clientData.phone,
        } : invoiceRecord.client_name ? {
          id: 0,
          name: invoiceRecord.client_name,
          fiscal_id: '',
          country: 'PT',
          address: null,
          postal_code: null,
          city: null,
          email: null,
          phone: null,
        } : null,
        items,
        tax_summary: [],
        source: 'keyinvoice',
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // InvoiceXpress flow
    if (!org?.invoicexpress_account_name || !org?.invoicexpress_api_key) {
      return new Response(JSON.stringify({ error: 'Credenciais InvoiceXpress não configuradas' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = `https://${org.invoicexpress_account_name}.app.invoicexpress.com`
    const apiKey = org.invoicexpress_api_key

    // 1. Fetch document details
    const detailsUrl = `${baseUrl}/${typeConfig.endpoint}/${document_id}.json?api_key=${apiKey}`
    const detailsRes = await fetch(detailsUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })

    if (!detailsRes.ok) {
      const errorText = await detailsRes.text()
      console.error('InvoiceXpress details error:', errorText)
      return new Response(JSON.stringify({ error: `Erro ao obter documento: ${detailsRes.status}`, details: errorText }), {
        status: detailsRes.status === 404 ? 404 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const detailsData = await detailsRes.json()
    const doc = detailsData[typeConfig.responseKey]

    if (!doc) {
      return new Response(JSON.stringify({ error: 'Documento não encontrado na resposta' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch QR code URL
    let qrCodeUrl: string | null = null
    try {
      const qrRes = await fetch(`${baseUrl}/api/qr_codes/${document_id}.json?api_key=${apiKey}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
      if (qrRes.ok) {
        const qrData = await qrRes.json()
        qrCodeUrl = qrData?.qr_code?.url || null
      }
    } catch (e) {
      console.warn('QR code fetch failed:', e)
    }

    // 2. Always ensure PDF is in storage and get signed URL
    const { storagePath, signedUrl: pdfSignedUrl } = await ensurePdfInStorage(
      supabase, baseUrl, apiKey, document_id, document_type, organization_id
    )

    // Build response
    const result: any = {
      id: doc.id,
      status: doc.status,
      sequence_number: doc.sequence_number || doc.inverted_sequence_number,
      atcud: doc.atcud,
      date: doc.date,
      due_date: doc.due_date,
      permalink: doc.permalink,
      sum: doc.sum,
      discount: doc.discount,
      before_taxes: doc.before_taxes,
      taxes: doc.taxes,
      total: doc.total,
      retention: doc.retention || 0,
      currency: doc.currency,
      tax_exemption: doc.tax_exemption,
      observations: doc.observations || null,
      mb_reference: doc.mb_reference || null,
      cancel_reason: doc.cancel_reason || null,
      qr_code_url: qrCodeUrl,
      pdf_url: storagePath,
      pdf_signed_url: pdfSignedUrl,
      owner: doc.owner ? {
        name: doc.owner.name,
        fiscal_id: doc.owner.fiscal_id,
        address: doc.owner.address,
        postal_code: doc.owner.postal_code,
        city: doc.owner.city,
        country: doc.owner.country,
        email: doc.owner.email,
        phone: doc.owner.phone,
      } : null,
      client: doc.client ? {
        id: doc.client.id,
        name: doc.client.name,
        fiscal_id: doc.client.fiscal_id,
        country: doc.client.country,
        address: doc.client.address || null,
        postal_code: doc.client.postal_code || null,
        city: doc.client.city || null,
        email: doc.client.email || null,
        phone: doc.client.phone || null,
      } : null,
      items: (doc.items || []).map((item: any) => ({
        name: item.name,
        description: item.description,
        unit_price: item.unit_price,
        quantity: item.quantity,
        tax: item.tax,
        discount: item.discount,
        subtotal: item.subtotal,
        tax_amount: item.tax_amount,
        total: item.total,
      })),
      tax_summary: buildTaxSummary(doc.items || []),
    }

    if (doc.bank_info) {
      result.bank_info = doc.bank_info
    }

    // 3. If sync=true, update DB with storage path
    if (sync && sale_id) {
      if (payment_id) {
        const updateData: any = {}
        if (storagePath) updateData.invoice_file_url = storagePath
        if (qrCodeUrl) updateData.qr_code_url = qrCodeUrl

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('sale_payments')
            .update(updateData)
            .eq('id', payment_id)
            .eq('sale_id', sale_id)
        }
      } else {
        const updateData: any = {}
        if (storagePath) updateData.invoice_pdf_url = storagePath
        if (qrCodeUrl) updateData.qr_code_url = qrCodeUrl

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('sales')
            .update(updateData)
            .eq('id', sale_id)
            .eq('organization_id', organization_id)
        }
      }
    }

    return new Response(JSON.stringify(result), {
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
