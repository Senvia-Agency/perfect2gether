import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_KEYINVOICE_API_URL = 'https://login.keyinvoice.com/API5.php'

/**
 * KeyInvoice Auth (API 5.0) - authenticates and returns a cached Sid session token.
 * Uses method:"authenticate" with header Apikey to get a Sid (TTL 3600s).
 * Caches the Sid in the organizations table for reuse.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { organization_id } = await req.json()
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('keyinvoice_password, keyinvoice_api_url, keyinvoice_sid, keyinvoice_sid_expires_at')
      .eq('id', organization_id)
      .single()

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Organização não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!org.keyinvoice_password) {
      return new Response(JSON.stringify({ error: 'Chave da API KeyInvoice não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check cached Sid (valid if expires_at > now + 5min margin)
    const now = new Date()
    const margin = 5 * 60 * 1000 // 5 minutes
    if (org.keyinvoice_sid && org.keyinvoice_sid_expires_at) {
      const expiresAt = new Date(org.keyinvoice_sid_expires_at)
      if (expiresAt.getTime() > now.getTime() + margin) {
        return new Response(JSON.stringify({ token: org.keyinvoice_sid }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
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
      console.error('KeyInvoice authenticate HTTP error:', authRes.status, errorText)
      return new Response(JSON.stringify({ error: `Erro ao autenticar no KeyInvoice: ${authRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authData = await authRes.json()
    if (authData.Status !== 1 || !authData.Sid) {
      console.error('KeyInvoice authenticate failed:', authData.ErrorMessage)
      return new Response(JSON.stringify({ error: `KeyInvoice: ${authData.ErrorMessage || 'Erro de autenticação'}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newSid = authData.Sid
    const expiresAt = new Date(now.getTime() + 3600 * 1000) // TTL 3600s

    // Cache the Sid
    await supabase
      .from('organizations')
      .update({ keyinvoice_sid: newSid, keyinvoice_sid_expires_at: expiresAt.toISOString() })
      .eq('id', organization_id)

    return new Response(JSON.stringify({ token: newSid }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('keyinvoice-auth error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
