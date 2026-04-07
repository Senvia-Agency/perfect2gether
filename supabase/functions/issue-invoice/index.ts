import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  PT: 'Portugal', ES: 'Espanha', FR: 'França', DE: 'Alemanha', IT: 'Itália',
  GB: 'Reino Unido', US: 'Estados Unidos', BR: 'Brasil', AO: 'Angola', MZ: 'Moçambique',
  CV: 'Cabo Verde', NL: 'Países Baixos', BE: 'Bélgica', CH: 'Suíça', AT: 'Áustria',
  IE: 'Irlanda', LU: 'Luxemburgo', PL: 'Polónia', SE: 'Suécia', DK: 'Dinamarca',
}

function mapCountryToInvoiceXpress(country?: string | null): string {
  if (!country) return 'Portugal'
  const upper = country.trim().toUpperCase()
  if (upper.length === 2 && COUNTRY_CODE_MAP[upper]) {
    return COUNTRY_CODE_MAP[upper]
  }
  return country
}

const DEFAULT_KEYINVOICE_API_URL = 'https://login.keyinvoice.com/API5.php'

// API 5.0: Authenticate with Apikey header, get session Sid, cache it
async function getKeyInvoiceSid(supabase: any, org: any, orgId: string): Promise<string> {
  if (!org.keyinvoice_password) {
    throw new Error('Chave da API KeyInvoice não configurada')
  }

  // Check cached Sid (valid if expires_at > now + 5min margin)
  const now = new Date()
  const margin = 5 * 60 * 1000
  if (org.keyinvoice_sid && org.keyinvoice_sid_expires_at) {
    const expiresAt = new Date(org.keyinvoice_sid_expires_at)
    if (expiresAt.getTime() > now.getTime() + margin) {
      return org.keyinvoice_sid
    }
  }

  // Authenticate to get a new Sid
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

  // Cache the Sid
  await supabase
    .from('organizations')
    .update({ keyinvoice_sid: newSid, keyinvoice_sid_expires_at: expiresAt.toISOString() })
    .eq('id', orgId)

  return newSid
}

async function handleKeyInvoice(supabase: any, org: any, saleId: string, organizationId: string, observations: string | undefined, corsHeaders: Record<string, string>) {
  if (!org?.keyinvoice_password) {
    return new Response(JSON.stringify({ error: 'Chave da API KeyInvoice não configurada' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch sale with client
  const { data: sale } = await supabase
    .from('sales')
    .select(`*, client:crm_clients(name, code, email, nif, phone, address_line1, city, postal_code, country, company), lead:leads(name, email, phone)`)
    .eq('id', saleId)
    .eq('organization_id', organizationId)
    .single()

  if (!sale) {
    return new Response(JSON.stringify({ error: 'Venda não encontrada' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (sale.invoicexpress_id) {
    return new Response(JSON.stringify({ error: 'Fatura já emitida para esta venda', invoice_reference: sale.invoice_reference }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const clientNif = sale.client?.nif
  if (!clientNif) {
    return new Response(JSON.stringify({ error: 'Cliente sem NIF. Adicione o NIF antes de emitir fatura.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sid = await getKeyInvoiceSid(supabase, org, organizationId)
  const apiUrl = org.keyinvoice_api_url || DEFAULT_KEYINVOICE_API_URL

  // Tax config
  const taxConfig = org?.tax_config || { tax_value: 23 }
  const orgTaxValue = taxConfig.tax_value ?? 23

  // Fetch sale items
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('*, product:products(code, tax_value, tax_exemption_reason)')
    .eq('sale_id', saleId)

  const clientName = sale.client?.company || sale.client?.name || sale.lead?.name || 'Cliente'
  const clientCode = sale.client?.code || clientNif

  // Resolve client in KeyInvoice: try insertClient first, then fallback to listClients by VATIN
  let keyInvoiceClientId: string | null = null
  try {
    const insertClientPayload: Record<string, any> = {
      method: 'insertClient',
      Name: clientName,
      VATIN: clientNif,
      CountryCode: 'PT',
    }
    if (sale.client?.email) insertClientPayload.Email = sale.client.email
    if (sale.client?.phone) insertClientPayload.Phone = sale.client.phone
    if (sale.client?.address_line1) insertClientPayload.Address = sale.client.address_line1
    if (sale.client?.city) insertClientPayload.Locality = sale.client.city
    if (sale.client?.postal_code) insertClientPayload.PostalCode = sale.client.postal_code

    const clientRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Sid': sid },
      body: JSON.stringify(insertClientPayload),
    })
    if (clientRes.ok) {
      const clientData = await clientRes.json()
      if (clientData.Status === 1 && clientData.Data?.Id) {
        keyInvoiceClientId = String(clientData.Data.Id)
        console.log('KeyInvoice client created, Id:', keyInvoiceClientId)
      } else {
        console.log('KeyInvoice insertClient response (may already exist):', clientData.ErrorMessage)
      }
    }
  } catch (e) {
    console.warn('KeyInvoice insertClient failed (non-blocking):', e)
  }

  // If insertClient didn't return Id, search in listClients by VATIN
  if (!keyInvoiceClientId) {
    try {
      const listClientsRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Sid': sid },
        body: JSON.stringify({ method: 'listClients' }),
      })
      const listClientsData = await listClientsRes.json()
      if (listClientsData.Status === 1 && listClientsData.Data?.Clients) {
        const clients = Array.isArray(listClientsData.Data.Clients) ? listClientsData.Data.Clients : []
        const match = clients.find((c: any) => c.VATIN === clientNif)
        if (match?.IdClient) {
          keyInvoiceClientId = String(match.IdClient)
          console.log('KeyInvoice client found via listClients, IdClient:', keyInvoiceClientId)
        }
      }
    } catch (e) {
      console.warn('KeyInvoice listClients failed:', e)
    }
  }

  if (!keyInvoiceClientId) {
    console.log('KeyInvoice: No client Id obtained. Will pass VATIN directly to insertDocument.')
  }

  // Fetch all products from KeyInvoice
  let keyInvoiceProducts: any[] = []
  try {
    const listRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Sid': sid },
      body: JSON.stringify({ method: 'listProducts' }),
    })
    const listData = await listRes.json()
    console.log('KeyInvoice listProducts FULL response:', JSON.stringify(listData).substring(0, 2000))

    if (listData.Status === 1 && listData.Data) {
      if (Array.isArray(listData.Data)) {
        keyInvoiceProducts = listData.Data
      } else if (Array.isArray(listData.Data.Products)) {
        keyInvoiceProducts = listData.Data.Products
      } else if (Array.isArray(listData.Data.Product)) {
        keyInvoiceProducts = listData.Data.Product
      } else if (typeof listData.Data === 'object') {
        const keys = Object.keys(listData.Data)
        console.log('KeyInvoice listProducts Data keys:', keys.join(', '))
        for (const key of keys) {
          if (Array.isArray(listData.Data[key])) {
            keyInvoiceProducts = listData.Data[key]
            break
          }
        }
        if (keyInvoiceProducts.length === 0 && listData.Data.Id) {
          keyInvoiceProducts = [listData.Data]
        }
      }
    }
    console.log('KeyInvoice products found:', keyInvoiceProducts.length,
      keyInvoiceProducts.map((p: any) => `${p.IdProduct || p.Id}:${p.Description || p.Name}`).join(', '))
  } catch (e) {
    console.warn('KeyInvoice listProducts failed:', e)
  }

  // If no products exist, create them automatically via insertProduct
  if (keyInvoiceProducts.length === 0) {
    console.log('KeyInvoice: 0 products found, creating automatically via insertProduct')
    const itemsToCreate = (saleItems && saleItems.length > 0)
      ? saleItems
      : [{ name: `Venda ${sale.code || saleId}`, quantity: 1, unit_price: sale.total_value }]

    for (const item of itemsToCreate) {
      const itemName = item.name || 'Servico'
      const itemCode = item.product?.code || itemName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'SRV001'

      const insertProductPayload: Record<string, any> = {
        method: 'insertProduct',
        IdProduct: itemCode,
        Name: itemName,
        TaxValue: String(orgTaxValue),
        IsService: '1',
        HasStocks: '0',
        Active: '1',
        Price: String(Number(item.unit_price)),
      }

      if (orgTaxValue === 0) {
        insertProductPayload.TaxExemptionReasonCode = 'M10'
      }

      const prodRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Sid': sid },
        body: JSON.stringify(insertProductPayload),
      })
      const prodData = await prodRes.json()
      console.log('KeyInvoice insertProduct response:', JSON.stringify(prodData))

      if (prodData.Status === 1 && (prodData.Data?.IdProduct || prodData.Data?.Id)) {
        keyInvoiceProducts.push({
          IdProduct: prodData.Data.IdProduct || prodData.Data.Id,
          Name: itemName,
          Description: itemName,
        })
      } else {
        console.error('KeyInvoice insertProduct failed:', prodData.ErrorMessage)
        return new Response(JSON.stringify({
          error: `Erro ao criar produto "${itemName}" no KeyInvoice: ${prodData.ErrorMessage || 'Erro desconhecido'}`,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    console.log('KeyInvoice: Created', keyInvoiceProducts.length, 'products automatically')
  }

  function findProductId(name: string): string {
    const getId = (p: any) => p.IdProduct || p.Id
    const exactMatch = keyInvoiceProducts.find((p: any) => 
      (p.Description || p.Name || '').toLowerCase() === name.toLowerCase()
    )
    if (exactMatch && getId(exactMatch)) return String(getId(exactMatch))

    const partialMatch = keyInvoiceProducts.find((p: any) => 
      (p.Description || p.Name || '').toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes((p.Description || p.Name || '').toLowerCase())
    )
    if (partialMatch && getId(partialMatch)) return String(getId(partialMatch))

    const fallbackId = getId(keyInvoiceProducts[0])
    console.log('KeyInvoice: No product match for "' + name + '", using first product:', fallbackId)
    return String(fallbackId)
  }

  const items = (saleItems && saleItems.length > 0) 
    ? saleItems 
    : [{ name: `Venda ${sale.code || saleId}`, quantity: 1, unit_price: sale.total_value }]

  const docLines: any[] = []
  {
    for (const item of items) {
      // Try to match product in KeyInvoice: first by code, then by name
      const itemCode = item.product?.code
      let productId: string | null = null
      
      // Check if the local product code matches any KeyInvoice IdProduct directly
      if (itemCode) {
        const codeMatch = keyInvoiceProducts.find((p: any) => 
          String(p.IdProduct || p.Id) === itemCode
        )
        if (codeMatch) {
          productId = String(codeMatch.IdProduct || codeMatch.Id)
        }
      }
      
      // Fallback to name-based matching
      if (!productId) {
        productId = findProductId(item.name || 'Serviço')
      }
      
      docLines.push({
        IdProduct: productId,
        Qty: String(Number(item.quantity)),
        Price: String(Number(item.unit_price)),
      })
    }
  }
  console.log('KeyInvoice DocLines:', JSON.stringify(docLines))

  // Determinar DocType com base no estado de pagamento
  const { data: payments } = await supabase
    .from('sale_payments')
    .select('status, amount')
    .eq('sale_id', saleId)

  const totalPaid = (payments || [])
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0)

  // DocType 4 = Fatura (FT), DocType 34 = Fatura-Recibo (FR)
  const docType = totalPaid >= sale.total_value ? '34' : '4'
  const docLabel = docType === '34' ? 'Fatura-Recibo' : 'Fatura'
  const docTypeCode = docType === '34' ? 'FR' : 'FT'
  console.log(`KeyInvoice: Emitting ${docLabel} (DocType ${docType}), totalPaid=${totalPaid}, saleTotal=${sale.total_value}`)

  // Auto-generate observations from payment schedule if not provided
  let finalObservations = observations || ''
  if (!finalObservations) {
    const { data: salePaymentsForObs } = await supabase
      .from('sale_payments')
      .select('amount, payment_date, status')
      .eq('sale_id', saleId)
      .order('payment_date', { ascending: true })

    if (salePaymentsForObs && salePaymentsForObs.length > 1) {
      finalObservations = `Pagamento em ${salePaymentsForObs.length} parcelas:\n\n` +
        salePaymentsForObs.map((p: any, i: number) => {
          const d = new Date(p.payment_date)
          const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
          return `${i+1}. ${dateStr} - ${Number(p.amount).toFixed(2)}€`
        }).join('\n\n')
    } else if (salePaymentsForObs && salePaymentsForObs.length === 1) {
      const p = salePaymentsForObs[0]
      const d = new Date(p.payment_date)
      const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      finalObservations = `Data de pagamento: ${dateStr}`
    }
  }

  // 1. Create document using real KeyInvoice API: method:"insertDocument"
  const insertPayload: Record<string, any> = {
    method: 'insertDocument',
    DocType: docType,
    DocLines: docLines,
  }
  if (keyInvoiceClientId) {
    insertPayload.IdClient = keyInvoiceClientId
  } else {
    // Pass VATIN so the API can resolve the client internally
    insertPayload.ClientVATIN = clientNif
    insertPayload.ClientName = clientName
  }
  if (finalObservations) {
    insertPayload.Comments = finalObservations
  }
  console.log('KeyInvoice insertDocument FULL payload:', JSON.stringify(insertPayload).substring(0, 2000))

  const createRes = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Sid': sid },
    body: JSON.stringify(insertPayload),
  })

  if (!createRes.ok) {
    const errorText = await createRes.text()
    console.error('KeyInvoice insertDocument HTTP error:', createRes.status, errorText)
    return new Response(JSON.stringify({ error: `Erro ao criar documento no KeyInvoice: ${createRes.status}`, details: errorText }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const createData = await createRes.json()
  console.log('KeyInvoice insertDocument FULL response:', JSON.stringify(createData).substring(0, 2000))
  
  // Real API returns {Status:1,Data:{DocType,DocSeries,DocNum,FullDocNumber}}
  if (createData.Status !== 1 || !createData.Data) {
    const errorMsg = createData.ErrorMessage || 'Erro ao criar documento'
    console.error('KeyInvoice insertDocument failed:', errorMsg)
    return new Response(JSON.stringify({ error: `KeyInvoice: ${errorMsg}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const docNum = createData.Data.DocNum
  const fullDocNumber = createData.Data.FullDocNumber || `${docTypeCode} ${docNum}`
  const docSeries = createData.Data.DocSeries

  // 2. Get PDF via method:"getDocumentPDF" (returns Base64)
  let storedPdfPath: string | null = null
  try {
    const pdfPayload: Record<string, string> = {
      method: 'getDocumentPDF',
      DocType: docType,
      DocNum: String(docNum),
    }
    if (docSeries) pdfPayload.DocSeries = String(docSeries)

    const pdfRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Sid': sid },
      body: JSON.stringify(pdfPayload),
    })

    if (pdfRes.ok) {
      const pdfData = await pdfRes.json()
      console.log('KeyInvoice getDocumentPDF response Status:', pdfData.Status,
        'Data type:', typeof pdfData.Data,
        typeof pdfData.Data === 'object' && pdfData.Data !== null ? 'keys: ' + JSON.stringify(Object.keys(pdfData.Data)) : '')

      if (pdfData.Status === 1 && pdfData.Data) {
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
        }
        
         const binaryStr = base64Pdf ? atob(base64Pdf) : null
        if (binaryStr) {
          const bytes = new Uint8Array(binaryStr.length)
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i)
          }

          const pdfFileName = `${organizationId}/${saleId}/${docTypeCode}-${docNum}.pdf`
          const { error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(pdfFileName, bytes.buffer, { contentType: 'application/pdf', upsert: true })
          if (!uploadError) storedPdfPath = pdfFileName
        }
      }
    }
  } catch (e) {
    console.warn('KeyInvoice PDF generation failed (non-blocking):', e)
  }

  // 3. Save reference in sales table
  await supabase
    .from('sales')
    .update({
      invoicexpress_id: docNum,
      invoicexpress_type: docTypeCode,
      invoice_reference: fullDocNumber,
      status: 'delivered',
      ...(storedPdfPath ? { invoice_pdf_url: storedPdfPath } : {}),
    })
    .eq('id', saleId)

  // 4. Insert into invoices table so it appears in Faturas tab
  const invoiceDocType = docTypeCode === 'FR' ? 'invoice_receipt' : 'invoice'
  await supabase
    .from('invoices')
    .upsert({
      organization_id: organizationId,
      invoicexpress_id: docNum,
      reference: fullDocNumber,
      document_type: invoiceDocType,
      status: 'final',
      client_name: clientName,
      total: sale.total_value,
      date: new Date().toISOString().split('T')[0],
      due_date: null,
      sale_id: saleId,
      payment_id: null,
      pdf_path: storedPdfPath || null,
      raw_data: { source: 'keyinvoice', docType, docNum, docSeries },
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,invoicexpress_id',
    })

  return new Response(JSON.stringify({
    success: true,
    invoicexpress_id: docNum,
    invoice_reference: fullDocNumber,
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth check
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

    const { sale_id, organization_id, observations } = await req.json()
    if (!sale_id || !organization_id) {
      return new Response(JSON.stringify({ error: 'sale_id e organization_id são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is member of org
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

    // Fetch organization credentials
    const { data: org } = await supabase
      .from('organizations')
      .select('invoicexpress_account_name, invoicexpress_api_key, integrations_enabled, tax_config, billing_provider, keyinvoice_password, keyinvoice_api_url, keyinvoice_sid, keyinvoice_sid_expires_at')
      .eq('id', organization_id)
      .single()

    const billingProvider = (org as any)?.billing_provider || 'invoicexpress'
    const integrationsEnabled = (org?.integrations_enabled as Record<string, boolean> | null) || {}
    
    // Check if the ACTIVE billing provider is enabled
    const activeBillingToggle = billingProvider === 'keyinvoice' ? 'keyinvoice' : 'invoicexpress'
    if (integrationsEnabled[activeBillingToggle] === false) {
      return new Response(JSON.stringify({ error: 'Integração de faturação desativada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Route to KeyInvoice if selected
    if (billingProvider === 'keyinvoice') {
      return await handleKeyInvoice(supabase, org, sale_id, organization_id, observations, corsHeaders)
    }

    if (!org?.invoicexpress_account_name || !org?.invoicexpress_api_key) {
      return new Response(JSON.stringify({ error: 'Credenciais InvoiceXpress não configuradas' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch sale with client
    const { data: sale } = await supabase
      .from('sales')
      .select(`
        *,
        client:crm_clients(name, code, email, nif, phone, address_line1, address_line2, city, postal_code, country, company),
        lead:leads(name, email, phone)
      `)
      .eq('id', sale_id)
      .eq('organization_id', organization_id)
      .single()

    if (!sale) {
      return new Response(JSON.stringify({ error: 'Venda não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if invoice already exists for this sale
    if (sale.invoicexpress_id) {
      return new Response(JSON.stringify({ 
        error: 'Fatura já emitida para esta venda', 
        invoice_reference: sale.invoice_reference,
        invoicexpress_id: sale.invoicexpress_id,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const clientNif = sale.client?.nif
    if (!clientNif) {
      return new Response(JSON.stringify({ error: 'Cliente sem NIF. Adicione o NIF antes de emitir fatura.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Tax configuration (org-level fallback)
    const taxConfig = (org as any)?.tax_config || { tax_name: 'IVA23', tax_value: 23, tax_exemption_reason: null }
    const orgTaxValue = taxConfig.tax_value ?? 23
    const orgTaxExemptionReason = taxConfig.tax_exemption_reason || null

    // Build item with per-item tax support
    const buildItem = (name: string, description: string, unitPrice: number, quantity: number, itemTaxValue?: number | null, itemTaxExemptionReason?: string | null) => {
      const effectiveTaxValue = (itemTaxValue !== null && itemTaxValue !== undefined) ? itemTaxValue : orgTaxValue
      const effectiveTaxName = effectiveTaxValue === 0 ? 'Isento' : `IVA${effectiveTaxValue}`
      const effectiveExemptionReason = effectiveTaxValue === 0 
        ? (itemTaxExemptionReason || orgTaxExemptionReason) 
        : null

      const item: any = {
        name,
        description,
        unit_price: unitPrice,
        quantity,
        tax: { name: effectiveTaxName, value: effectiveTaxValue },
      }
      if (effectiveTaxValue === 0 && effectiveExemptionReason) {
        item.exemption_reason = effectiveExemptionReason
      }
      return item
    }

    // Always emit invoice for the full sale total using sale_items
    let items: any[] = []
    let hasExemptItem = false
    let firstExemptionReason: string | null = null

    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('*, product:products(tax_value, tax_exemption_reason)')
      .eq('sale_id', sale_id)

    items = (saleItems || []).map((item: any) => {
      const productTaxValue = item.product?.tax_value ?? null
      const productTaxExemptionReason = item.product?.tax_exemption_reason ?? null
      const effectiveTax = (productTaxValue !== null && productTaxValue !== undefined) ? productTaxValue : orgTaxValue
      if (effectiveTax === 0) {
        hasExemptItem = true
        if (!firstExemptionReason) {
          firstExemptionReason = productTaxExemptionReason || orgTaxExemptionReason
        }
      }
      return buildItem(item.name, item.name, Number(item.unit_price), Number(item.quantity), productTaxValue, productTaxExemptionReason)
    })

    if (items.length === 0) {
      items.push(buildItem('Serviço', `Venda ${sale.code || sale_id}`, Number(sale.total_value), 1))
      if (orgTaxValue === 0) {
        hasExemptItem = true
        firstExemptionReason = orgTaxExemptionReason
      }
    }

    // Validate exemption reason
    if (hasExemptItem && !firstExemptionReason) {
      return new Response(JSON.stringify({ 
        error: 'Configure o motivo de isenção de IVA no produto ou nas Definições → Integrações → InvoiceXpress antes de emitir faturas.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Date
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    let dateSource = todayStr

    const accountName = org.invoicexpress_account_name
    const apiKey = org.invoicexpress_api_key
    const baseUrl = `https://${accountName}.app.invoicexpress.com`

    // Check last invoice date for chronological order
    try {
      const listRes = await fetch(`${baseUrl}/invoices.json?api_key=${apiKey}&page=1&per_page=1`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (listRes.ok) {
        const listData = await listRes.json()
        const docs = listData.invoices || []
        if (Array.isArray(docs) && docs.length > 0) {
          const lastDateStr = docs[0]?.date
          if (lastDateStr) {
            const [ld, lm, ly] = lastDateStr.split('/')
            const lastDateISO = `${ly}-${lm}-${ld}`
            if (dateSource < lastDateISO) {
              console.warn(`Date ${dateSource} is before last invoice date ${lastDateISO}. Adjusting.`)
              dateSource = lastDateISO
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not check last invoice date, proceeding with current date:', e)
    }

    const [y, m, d] = dateSource.split('-')
    const formattedDate = `${d}/${m}/${y}`

    const clientName = sale.client?.company || sale.client?.name || sale.lead?.name || 'Cliente'
    const clientCode = sale.client?.code || clientNif
    const proprietary_uid = `senvia-sale-${sale_id}`

    // Build observations from payments if not provided by frontend
    let finalObservations = observations || ''
    if (!finalObservations) {
      const { data: salePayments } = await supabase
        .from('sale_payments')
        .select('amount, payment_date, status')
        .eq('sale_id', sale_id)
        .order('payment_date', { ascending: true })
      
      if (salePayments && salePayments.length > 1) {
        finalObservations = `Pagamento em ${salePayments.length} parcelas:\n\n` +
          salePayments.map((p: any, i: number) => {
            const d = new Date(p.payment_date)
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            return `- ${i + 1}.ª parcela: ${Number(p.amount).toFixed(2)} EUR - ${dateStr}`
          }).join('\n\n')
      } else if (salePayments && salePayments.length === 1) {
        const p = salePayments[0]
        const d = new Date(p.payment_date)
        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        finalObservations = `Data de pagamento: ${dateStr}`
      }
    }

    // Build InvoiceXpress payload - always invoice type
    const invoicePayload = {
      invoice: {
        date: formattedDate,
        due_date: formattedDate,
        ...(finalObservations ? { observations: finalObservations } : {}),
        ...(hasExemptItem && firstExemptionReason
          ? { tax_exemption: firstExemptionReason }
          : {}),
        client: {
          name: clientName,
          code: clientCode,
          fiscal_id: clientNif,
          email: sale.client?.email || sale.lead?.email || '',
          address: sale.client?.address_line1 || '',
          city: sale.client?.city || '',
          postal_code: sale.client?.postal_code || '',
          country: mapCountryToInvoiceXpress(sale.client?.country),
        },
        items: items,
      },
      proprietary_uid,
    }

    // 1. Create draft
    const createRes = await fetch(`${baseUrl}/invoices.json?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoicePayload),
    })

    // Handle 409 = duplicate
    if (createRes.status === 409) {
      return new Response(JSON.stringify({ error: 'Fatura já foi criada anteriormente para esta venda.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!createRes.ok) {
      const errorText = await createRes.text()
      console.error('InvoiceXpress create error:', errorText)
      return new Response(JSON.stringify({ error: `Erro ao criar fatura no InvoiceXpress: ${createRes.status}`, details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const createData = await createRes.json()
    const invoiceId = createData.invoice?.id
    const sequentialNumber = createData.invoice?.sequential_number
    const permalink = createData.invoice?.permalink || null

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'InvoiceXpress não retornou ID do documento', details: createData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Finalize
    const finalizeRes = await fetch(`${baseUrl}/invoices/${invoiceId}/change-state.json?api_key=${apiKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice: { state: 'finalized' },
      }),
    })

    if (!finalizeRes.ok) {
      const errorText = await finalizeRes.text()
      console.error('InvoiceXpress finalize error:', errorText)
      return new Response(JSON.stringify({ 
        error: 'Fatura criada mas não finalizada. Finalize manualmente no InvoiceXpress.',
        invoicexpress_id: invoiceId,
        details: errorText,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let invoiceReference = sequentialNumber ? `FT ${sequentialNumber}` : `FT #${invoiceId}`
    try {
      const finalizeData = await finalizeRes.json()
      if (finalizeData.invoice?.sequential_number) {
        invoiceReference = `FT ${finalizeData.invoice.sequential_number}`
      }
    } catch {
      // Use default reference
    }

    // 3. Generate PDF
    let pdfUrl: string | null = null
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const pdfRes = await fetch(`${baseUrl}/api/pdf/${invoiceId}.json?api_key=${apiKey}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        })
        if (pdfRes.status === 200) {
          const pdfData = await pdfRes.json()
          pdfUrl = pdfData?.output?.pdfUrl || null
          if (pdfUrl) break
        }
        if (pdfRes.status === 202 || !pdfUrl) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    } catch (e) {
      console.warn('PDF generation polling failed (non-blocking):', e)
    }

    // Download and store PDF locally
    let storedPdfPath: string | null = null
    if (pdfUrl) {
      try {
        const pdfBinaryRes = await fetch(pdfUrl)
        if (pdfBinaryRes.ok) {
          const pdfBuffer = await pdfBinaryRes.arrayBuffer()
          const pdfFileName = `${organization_id}/${sale_id}/FT-${invoiceId}.pdf`
          const { error: uploadError } = await supabase.storage
            .from('invoices')
            .upload(pdfFileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })
          if (!uploadError) {
            storedPdfPath = pdfFileName
          } else {
            console.warn('PDF upload to storage failed:', uploadError)
          }
        }
      } catch (e) {
        console.warn('PDF download/upload failed (non-blocking):', e)
      }
    }

    // 4. QR Code polling
    let qrCodeUrl: string | null = null
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const qrRes = await fetch(`${baseUrl}/api/qr_codes/${invoiceId}.json?api_key=${apiKey}`, {
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

    // 5. Save reference in sales table - use local path if available
    const fileUrl = storedPdfPath || pdfUrl || null
    await supabase
      .from('sales')
      .update({
        invoicexpress_id: invoiceId,
        invoicexpress_type: 'invoices',
        invoice_reference: invoiceReference,
        status: 'delivered',
        ...(fileUrl ? { invoice_pdf_url: fileUrl } : {}),
        ...(qrCodeUrl ? { qr_code_url: qrCodeUrl } : {}),
      })
      .eq('id', sale_id)

    return new Response(JSON.stringify({
      success: true,
      invoicexpress_id: invoiceId,
      invoice_reference: invoiceReference,
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
