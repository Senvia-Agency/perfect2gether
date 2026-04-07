import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function downloadAndUploadPdf(
  supabase: any,
  pdfUrl: string,
  storagePath: string
): Promise<string | null> {
  try {
    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) return null
    const pdfBlob = await pdfRes.blob()
    const arrayBuffer = await pdfBlob.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)

    const { error } = await supabase.storage
      .from('invoices')
      .upload(storagePath, uint8, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (error) {
      console.error('Upload error:', error)
      return null
    }
    return storagePath
  } catch (e) {
    console.error('Download/upload error:', e)
    return null
  }
}

async function pollPdfUrl(baseUrl: string, docId: number, apiKey: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/pdf/${docId}.json?api_key=${apiKey}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })
      if (res.status === 200) {
        const data = await res.json()
        const url = data?.output?.pdfUrl
        if (url) return url
      }
      if (i < 2) await new Promise(r => setTimeout(r, 2000))
    } catch (e) {
      if (i < 2) await new Promise(r => setTimeout(r, 2000))
    }
  }
  return null
}

interface DocType {
  endpoint: string
  listKey: string
  detailKey: string
  type: string
}

const DOC_TYPES: DocType[] = [
  { endpoint: 'invoices', listKey: 'invoices', detailKey: 'invoice', type: 'invoice' },
  { endpoint: 'invoice_receipts', listKey: 'invoice_receipts', detailKey: 'invoice_receipt', type: 'invoice_receipt' },
  { endpoint: 'simplified_invoices', listKey: 'simplified_invoices', detailKey: 'simplified_invoice', type: 'simplified_invoice' },
]

async function syncOrganization(supabase: any, organization_id: string, org: any) {
  const baseUrl = `https://${org.invoicexpress_account_name}.app.invoicexpress.com`
  const apiKey = org.invoicexpress_api_key

  let totalSynced = 0
  let totalMatched = 0
  let totalNotMatched = 0

  for (const docType of DOC_TYPES) {
    let allDocs: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = `${baseUrl}/${docType.endpoint}.json?api_key=${apiKey}&page=${page}&per_page=50`
      console.log(`[${organization_id}] Fetching ${docType.endpoint} page ${page}...`)

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error(`InvoiceXpress error for ${docType.endpoint}:`, res.status, errorText)
        break
      }

      const data = await res.json()
      const docs = data?.[docType.listKey] || []

      if (docs.length === 0) {
        hasMore = false
      } else {
        allDocs = allDocs.concat(docs)
        page++
        if (page > 20) hasMore = false
      }
    }

    console.log(`[${organization_id}] Found ${allDocs.length} ${docType.endpoint}`)

    for (const doc of allDocs) {
      const docId = doc.id
      const docRef = doc.sequence_number || doc.inverted_sequence_number || `${docType.type}-${docId}`
      const docTotal = parseFloat(doc.total || '0')
      const docDate = doc.date || null
      const docDueDate = doc.due_date || null
      const docClientName = doc.client?.name || null
      const docStatus = doc.status || null

      // Try to match to local sales/payments
      let matchedSaleId: string | null = null
      let matchedPaymentId: string | null = null

      // Match 0: by proprietary_uid in raw_data
      const proprietaryUid = doc.proprietary_uid || null
      if (proprietaryUid && typeof proprietaryUid === 'string' && proprietaryUid.startsWith('senvia-sale-')) {
        const extractedSaleId = proprietaryUid.replace('senvia-sale-', '')
        const { data: saleByUid } = await supabase
          .from('sales')
          .select('id')
          .eq('id', extractedSaleId)
          .eq('organization_id', organization_id)
          .maybeSingle()
        if (saleByUid) {
          matchedSaleId = saleByUid.id
        }
      }

      // Match 1: by invoicexpress_id on sales
      if (!matchedSaleId) {
        const { data: sale } = await supabase
          .from('sales')
          .select('id')
          .eq('organization_id', organization_id)
          .eq('invoicexpress_id', docId)
          .maybeSingle()
        if (sale) {
          matchedSaleId = sale.id
        }
      }

      // Match 2: by invoicexpress_id on sale_payments
      if (!matchedSaleId) {
        const { data: payment } = await supabase
          .from('sale_payments')
          .select('id, sale_id')
          .eq('organization_id', organization_id)
          .eq('invoicexpress_id', docId)
          .maybeSingle()

        if (payment) {
          matchedPaymentId = payment.id
          matchedSaleId = payment.sale_id || null
        }
      }

      // Match 3: by invoice_reference ILIKE on sale_payments (normalized)
      if (!matchedSaleId && !matchedPaymentId && docRef) {
        const cleanRef = docRef.replace(/^(FR|FT|FS)\s+/i, '')
        const seqPart = cleanRef.split('/').pop() || cleanRef
        const { data: payments } = await supabase
          .from('sale_payments')
          .select('id, sale_id')
          .eq('organization_id', organization_id)
          .ilike('invoice_reference', `%${seqPart}%`)
          .limit(1)

        if (payments && payments.length > 0) {
          matchedPaymentId = payments[0].id
          matchedSaleId = payments[0].sale_id || null
        }
      }

      // Match 4: by invoice_reference on sales (normalized)
      if (!matchedSaleId && docRef) {
        const cleanRef4 = docRef.replace(/^(FR|FT|FS)\s+/i, '')
        const seqPart = cleanRef4.split('/').pop() || cleanRef4
        const { data: sales } = await supabase
          .from('sales')
          .select('id')
          .eq('organization_id', organization_id)
          .ilike('invoice_reference', `%${seqPart}%`)
          .limit(1)

        if (sales && sales.length > 0) {
          matchedSaleId = sales[0].id
        }
      }

      // Match 5: by docId in payment invoice_reference (format "FT #DOCID")
      if (!matchedSaleId && !matchedPaymentId) {
        const { data: payments } = await supabase
          .from('sale_payments')
          .select('id, sale_id')
          .eq('organization_id', organization_id)
          .ilike('invoice_reference', `%${docId}%`)
          .limit(1)
        if (payments && payments.length > 0) {
          matchedPaymentId = payments[0].id
          matchedSaleId = payments[0].sale_id || null
        }
      }

      // Match 6: by client_name -> crm_clients -> sales
      if (!matchedSaleId && !matchedPaymentId && docClientName) {
        const { data: clients } = await supabase
          .from('crm_clients')
          .select('id')
          .eq('organization_id', organization_id)
          .ilike('name', `%${docClientName}%`)
          .limit(1)

        if (clients && clients.length > 0) {
          const { data: sales } = await supabase
            .from('sales')
            .select('id')
            .eq('organization_id', organization_id)
            .eq('client_id', clients[0].id)
            .order('created_at', { ascending: false })
            .limit(1)

          if (sales && sales.length > 0) {
            matchedSaleId = sales[0].id
          }
        }
      }

      // Skip if this document already exists as a credit note
      const { data: existingCN } = await supabase
        .from('credit_notes')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('invoicexpress_id', docId)
        .maybeSingle()

      if (existingCN) {
        console.log(`Skipping ${docId} - already exists as credit note`)
        continue
      }

      // Download PDF
      let pdfPath: string | null = null
      try {
        const pdfTempUrl = await pollPdfUrl(baseUrl, docId, apiKey)
        if (pdfTempUrl) {
          const fileName = `${organization_id}/${docType.type}_${docId}.pdf`
          pdfPath = await downloadAndUploadPdf(supabase, pdfTempUrl, fileName)
        }
      } catch (e) {
        console.warn(`Failed to download PDF for ${docType.type} ${docId}:`, e)
      }

      // Upsert
      const { error: upsertError } = await supabase
        .from('invoices')
        .upsert({
          organization_id,
          invoicexpress_id: docId,
          reference: docRef,
          document_type: docType.type,
          status: docStatus,
          client_name: docClientName,
          total: docTotal,
          date: docDate,
          due_date: docDueDate,
          sale_id: matchedSaleId,
          payment_id: matchedPaymentId,
          pdf_path: pdfPath,
          raw_data: doc,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,invoicexpress_id',
        })

      if (upsertError) {
        console.error(`Upsert error for ${docType.type} ${docId}:`, upsertError)
      }

      totalSynced++
      if (matchedSaleId || matchedPaymentId) {
        totalMatched++
      } else {
        totalNotMatched++
      }
    }
  }

  return { total: totalSynced, matched: totalMatched, not_matched: totalNotMatched }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const { sync_all, organization_id } = body

    // Mode 1: sync_all - internal cron call
    if (sync_all) {
      console.log('Running sync_all mode for all organizations...')
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, invoicexpress_account_name, invoicexpress_api_key')
        .not('invoicexpress_account_name', 'is', null)
        .not('invoicexpress_api_key', 'is', null)

      if (orgsError || !orgs?.length) {
        console.log('No organizations with IX credentials found')
        return new Response(JSON.stringify({ message: 'No organizations to sync' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let totalResults = { total: 0, matched: 0, not_matched: 0, orgs_processed: 0 }
      for (const org of orgs) {
        try {
          const result = await syncOrganization(supabase, org.id, org)
          totalResults.total += result.total
          totalResults.matched += result.matched
          totalResults.not_matched += result.not_matched
          totalResults.orgs_processed++
        } catch (e) {
          console.error(`Error syncing org ${org.id}:`, e)
        }
      }

      console.log('sync_all complete:', totalResults)
      return new Response(JSON.stringify(totalResults), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mode 2: single org sync (user-triggered)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    const { data: org } = await supabase
      .from('organizations')
      .select('invoicexpress_account_name, invoicexpress_api_key')
      .eq('id', organization_id)
      .single()

    if (!org?.invoicexpress_account_name || !org?.invoicexpress_api_key) {
      return new Response(JSON.stringify({ error: 'Credenciais InvoiceXpress não configuradas' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await syncOrganization(supabase, organization_id, org)

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
