import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const DEFAULT_KEYINVOICE_API_URL = 'https://login.keyinvoice.com/API5.php'

const KI_DOC_TYPE_MAP: Record<string, string> = {
  invoice: '4',
  invoice_receipt: '34',
  receipt: '10',
  credit_note: '8',
}

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

    const { 
      organization_id, 
      sale_id, 
      payment_id,
      original_document_id,
      original_document_type,
      reason,
      items,
    } = await req.json()

    if (!organization_id || !original_document_id || !original_document_type || !reason) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: organization_id, original_document_id, original_document_type, reason' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify membership
    const { data: isMember } = await supabase.rpc('is_org_member', {
      _user_id: user.id,
      _org_id: organization_id,
    })

    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Sem acesso a esta organização' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch org credentials
    const { data: org } = await supabase
      .from('organizations')
      .select('invoicexpress_account_name, invoicexpress_api_key, integrations_enabled, tax_config, billing_provider, keyinvoice_password, keyinvoice_api_url, keyinvoice_sid, keyinvoice_sid_expires_at')
      .eq('id', organization_id)
      .single()

    const billingProvider = org?.billing_provider || 'invoicexpress'
    const integrationsEnabled = (org?.integrations_enabled as Record<string, boolean> | null) || {}

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

      // Parse reference "34 47/1" -> DocType=34, DocSeries=47, DocNum=1
      let kiDocType = KI_DOC_TYPE_MAP[original_document_type] || '4'
      let kiDocNum = String(original_document_id)
      let kiDocSeries: string | null = null

      // Look up the invoice record to get the real reference
      const { data: invoiceRecord } = await supabase
        .from('invoices')
        .select('reference, document_type, invoicexpress_id, raw_data')
        .eq('invoicexpress_id', original_document_id)
        .eq('organization_id', organization_id)
        .maybeSingle()

      if (invoiceRecord) {
        // Try raw_data first
        const raw = invoiceRecord.raw_data as Record<string, any> | null
        if (raw?.docType) kiDocType = String(raw.docType)
        if (raw?.docNum) kiDocNum = String(raw.docNum)
        if (raw?.docSeries) kiDocSeries = String(raw.docSeries)

        // Fallback: parse reference "34 47/1" -> DocType=34, DocSeries=47, DocNum=1
        if ((!raw?.docNum) && invoiceRecord.reference) {
          const match = invoiceRecord.reference.match(/^(\d+)\s+(\d+)\/(\d+)$/)
          if (match) {
            kiDocType = match[1]
            kiDocSeries = match[2]
            kiDocNum = match[3]
          }
        }
      }

      // KeyInvoice uses setDocumentVoid which auto-generates a credit note
      const voidPayload: Record<string, string> = {
        method: 'setDocumentVoid',
        DocType: kiDocType,
        DocNum: kiDocNum,
        CreditReason: reason,
      }
      if (kiDocSeries) voidPayload.DocSeries = kiDocSeries

      console.log('KeyInvoice setDocumentVoid payload:', JSON.stringify(voidPayload))

      const voidRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Sid': sid },
        body: JSON.stringify(voidPayload),
      })

      if (!voidRes.ok) {
        const errorText = await voidRes.text()
        console.error('KeyInvoice setDocumentVoid HTTP error:', voidRes.status, errorText)
        return new Response(JSON.stringify({ error: `Erro ao criar nota de crédito no KeyInvoice (${voidRes.status})`, details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const voidData = await voidRes.json()
      console.log('KeyInvoice setDocumentVoid response:', JSON.stringify(voidData))

      if (voidData.Status !== 1) {
        console.error('KeyInvoice setDocumentVoid failed:', voidData.ErrorMessage)
        return new Response(JSON.stringify({ error: `KeyInvoice: ${voidData.ErrorMessage || 'Erro ao criar nota de crédito'}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Build a useful reference from original doc info
      const creditNoteReference = kiDocSeries 
        ? `NC ${kiDocSeries}/${kiDocNum}` 
        : `NC ${kiDocNum}`
      // Use negative ID to avoid conflicts (KeyInvoice doesn't return a credit note ID)
      const kiCreditNoteId = -(original_document_id)

      // Save reference in database
      if (payment_id) {
        await supabase
          .from('sale_payments')
          .update({
            credit_note_id: kiCreditNoteId,
            credit_note_reference: creditNoteReference,
          })
          .eq('id', payment_id)
      }
      
      if (sale_id) {
        await supabase
          .from('sales')
          .update({
            credit_note_id: kiCreditNoteId,
            credit_note_reference: creditNoteReference,
          })
          .eq('id', sale_id)
      }

      // Fetch client_name and total from invoices table directly
      const { data: invoiceInfo } = await supabase
        .from('invoices')
        .select('client_name, total')
        .eq('invoicexpress_id', original_document_id)
        .eq('organization_id', organization_id)
        .maybeSingle()

      const { error: upsertError } = await supabase.from('credit_notes').upsert({
        organization_id,
        invoicexpress_id: kiCreditNoteId,
        reference: creditNoteReference,
        status: 'settled',
        client_name: invoiceInfo?.client_name || null,
        total: invoiceInfo?.total || null,
        date: new Date().toISOString().split('T')[0],
        related_invoice_id: original_document_id,
        sale_id: sale_id || null,
        payment_id: payment_id || null,
      }, { onConflict: 'invoicexpress_id,organization_id' })

      if (upsertError) {
        console.error('Failed to upsert credit note:', JSON.stringify(upsertError))
      }

      // Try to download credit note PDF from KeyInvoice
      let pdfPath: string | null = null
      try {
        const sid2 = await getKeyInvoiceSid(supabase, org, organization_id)
        const pdfPayload: Record<string, string> = {
          method: 'getDocumentPDF',
          DocType: '8',
          DocNum: kiDocNum,
        }
        if (kiDocSeries) pdfPayload.DocSeries = kiDocSeries

        console.log('KeyInvoice getDocumentPDF payload:', JSON.stringify(pdfPayload))

        const pdfRes = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Sid': sid2 },
          body: JSON.stringify(pdfPayload),
        })

        if (pdfRes.ok) {
          const pdfData = await pdfRes.json()
          console.log('KeyInvoice getDocumentPDF status:', pdfData.Status)

          if (pdfData.Status === 1 && pdfData.Data) {
            let base64Pdf = ''
            if (typeof pdfData.Data === 'string') {
              base64Pdf = pdfData.Data
            } else if (typeof pdfData.Data === 'object') {
              const knownKeys = ['PDF','pdf','Content','content','File','file','Base64','base64','FileContent','Document','document','PDFContent']
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

              const pdfFileName = `${organization_id}/credit_note_ki_${kiDocSeries || '0'}_${kiDocNum}.pdf`
              const { error: uploadError } = await supabase.storage.from('invoices').upload(pdfFileName, bytes.buffer, {
                contentType: 'application/pdf', upsert: true
              })

              if (!uploadError) {
                pdfPath = pdfFileName
                await supabase.from('credit_notes')
                  .update({ pdf_path: pdfFileName })
                  .eq('invoicexpress_id', kiCreditNoteId)
                  .eq('organization_id', organization_id)
                console.log('Credit note PDF saved:', pdfFileName)
              } else {
                console.error('PDF upload error:', JSON.stringify(uploadError))
              }
            }
          }
        }
      } catch (pdfErr) {
        console.error('KeyInvoice credit note PDF download failed:', pdfErr)
      }

      return new Response(JSON.stringify({
        success: true,
        credit_note_id: kiCreditNoteId,
        credit_note_reference: creditNoteReference,
        pdf_path: pdfPath,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========== InvoiceXpress Flow ==========
    if (integrationsEnabled.invoicexpress === false || !org?.invoicexpress_account_name || !org?.invoicexpress_api_key) {
      return new Response(JSON.stringify({ error: 'Integração de faturação não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accountName = org.invoicexpress_account_name
    const apiKey = org.invoicexpress_api_key
    const baseUrl = `https://${accountName}.app.invoicexpress.com`

    // First, get the original document details to build the credit note
    const docEndpointMap: Record<string, string> = { 
      invoice: 'invoices', 
      invoice_receipt: 'invoice_receipts', 
      receipt: 'receipts' 
    }
    const originalEndpoint = docEndpointMap[original_document_type] || 'invoices'

    const originalRes = await fetch(
      `${baseUrl}/${originalEndpoint}/${original_document_id}.json?api_key=${apiKey}`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    )

    if (!originalRes.ok) {
      return new Response(JSON.stringify({ error: 'Erro ao obter documento original do InvoiceXpress' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const originalData = await originalRes.json()
    const originalDoc = originalData[Object.keys(originalData)[0]] || {}

    // Build credit note items from original document or custom items
    let creditNoteItems: any[] = []
    
    if (items && items.length > 0) {
      creditNoteItems = items.map((item: any) => ({
        name: item.name,
        description: item.description || item.name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        ...(item.tax ? { tax: item.tax } : {}),
      }))
    } else if (originalDoc.items) {
      const rawItems = Array.isArray(originalDoc.items) ? originalDoc.items : (originalDoc.items?.item ? [originalDoc.items.item] : [])
      creditNoteItems = rawItems.map((item: any) => ({
        name: item.name,
        description: item.description || item.name,
        unit_price: Number(item.unit_price || 0),
        quantity: Number(item.quantity || 1),
        ...(item.tax ? { tax: { name: item.tax.name, value: Number(item.tax.value || 0) } } : {}),
      }))
    }

    if (creditNoteItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Não foi possível determinar os itens para a nota de crédito' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

    const taxExemption = originalDoc.tax_exemption || null

    const creditNotePayload = {
      credit_note: {
        date: todayStr,
        due_date: todayStr,
        reference: originalDoc.sequential_number || `Doc #${original_document_id}`,
        observations: reason,
        ...(taxExemption ? { tax_exemption: taxExemption } : {}),
        client: originalDoc.client ? {
          name: originalDoc.client.name,
          code: originalDoc.client.code,
          fiscal_id: originalDoc.client.fiscal_id,
          email: originalDoc.client.email || '',
          address: originalDoc.client.address || '',
          city: originalDoc.client.city || '',
          postal_code: originalDoc.client.postal_code || '',
          country: originalDoc.client.country || 'Portugal',
        } : undefined,
        items: creditNoteItems,
      },
    }

    // 1. Create credit note
    const createRes = await fetch(`${baseUrl}/credit_notes.json?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creditNotePayload),
    })

    if (!createRes.ok) {
      const errorText = await createRes.text()
      console.error('InvoiceXpress create credit note error:', errorText)
      return new Response(JSON.stringify({ 
        error: `Erro ao criar nota de crédito no InvoiceXpress: ${createRes.status}`,
        details: errorText,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const createData = await createRes.json()
    const creditNote = createData.credit_note || {}
    const creditNoteId = creditNote.id
    const creditNoteSeqNumber = creditNote.sequential_number

    if (!creditNoteId) {
      return new Response(JSON.stringify({ error: 'InvoiceXpress não retornou ID da nota de crédito' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Finalize credit note
    const finalizeRes = await fetch(
      `${baseUrl}/credit_notes/${creditNoteId}/change-state.json?api_key=${apiKey}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credit_note: { state: 'finalized' } }),
      }
    )

    let creditNoteReference = creditNoteSeqNumber ? `NC ${creditNoteSeqNumber}` : `NC #${creditNoteId}`
    
    if (finalizeRes.ok) {
      try {
        const finalizeData = await finalizeRes.json()
        if (finalizeData.credit_note?.sequential_number) {
          creditNoteReference = `NC ${finalizeData.credit_note.sequential_number}`
        }
      } catch {}
    } else {
      const errorText = await finalizeRes.text()
      console.error('InvoiceXpress finalize credit note error:', errorText)
    }

    // 3. Save reference in database
    if (payment_id) {
      await supabase
        .from('sale_payments')
        .update({
          credit_note_id: creditNoteId,
          credit_note_reference: creditNoteReference,
        })
        .eq('id', payment_id)
    }
    
    if (sale_id) {
      await supabase
        .from('sales')
        .update({
          credit_note_id: creditNoteId,
          credit_note_reference: creditNoteReference,
        })
        .eq('id', sale_id)
    }

    // Insert into credit_notes table for Finance visibility
    const ixClientName = originalDoc.client?.name || null
    const ixTotal = creditNote.total || originalDoc.total || null

    await supabase.from('credit_notes').upsert({
      organization_id,
      invoicexpress_id: creditNoteId,
      reference: creditNoteReference,
      status: 'settled',
      client_name: ixClientName,
      total: ixTotal ? Number(ixTotal) : null,
      date: new Date().toISOString().split('T')[0],
      related_invoice_id: original_document_id,
      sale_id: sale_id || null,
      payment_id: payment_id || null,
    }, { onConflict: 'invoicexpress_id,organization_id' })

    return new Response(JSON.stringify({
      success: true,
      credit_note_id: creditNoteId,
      credit_note_reference: creditNoteReference,
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
