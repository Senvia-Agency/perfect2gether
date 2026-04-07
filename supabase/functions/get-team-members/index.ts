import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // --- Auth (verify_jwt=false): validate JWT via signing keys
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user: authUser2 }, error: authError } = await authClient.auth.getUser(token)
    const userId = authUser2?.id

    if (authError || !userId) {
      console.error('auth.getUser failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Admin client for accessing DB + auth admin APIs (service role)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // Check if user is super_admin
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    const isSuperAdmin = userRoles?.some((r) => r.role === 'super_admin') ?? false

    // Get organization_id from query params or body
    const url = new URL(req.url)
    let organizationId = url.searchParams.get('organization_id')

    // If not in query params, try body
    if (!organizationId && req.method === 'POST') {
      try {
        const body = await req.json()
        organizationId = body.organization_id
      } catch {
        // ignore
      }
    }

    // If no org ID provided, try to get from profile
    if (!organizationId) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single()

      organizationId = profile?.organization_id
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization not found. Please provide organization_id.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user has access to this organization (unless super_admin)
    if (!isSuperAdmin) {
      const { data: membership } = await adminClient
        .from('organization_members')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .maybeSingle()

      // Also check if user's profile org matches
      const { data: profile } = await adminClient
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single()

      if (!membership && profile?.organization_id !== organizationId) {
        return new Response(
          JSON.stringify({ error: 'Access denied to this organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get all organization members
    const { data: members, error: membersError } = await adminClient
      .from('organization_members')
      .select('user_id, role, is_active, profile_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    if (membersError) {
      console.error('Error fetching members:', membersError)
      throw membersError
    }

    if (!members || members.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get profiles for these users
    const userIds = members.map((m) => m.user_id)

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, full_name, avatar_url, email, phone')
      .in('id', userIds)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }

    // Get roles for these users
    const { data: roles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds)

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      throw rolesError
    }

    // Fetch organization profiles to resolve profile names
    const profileIds = members.map((m) => m.profile_id).filter(Boolean)
    let orgProfiles: any[] = []
    if (profileIds.length > 0) {
      const { data: opData } = await adminClient
        .from('organization_profiles')
        .select('id, name')
        .in('id', profileIds)
      orgProfiles = opData || []
    }

    const teamMembers = await Promise.all(
      members.map(async (member) => {
        const profileItem = profiles?.find((p) => p.id === member.user_id)
        const userRole = roles?.find((r) => r.user_id === member.user_id)
        const orgProfile = orgProfiles.find((op) => op.id === member.profile_id)

        const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(
          member.user_id
        )

        if (authError) {
          console.error(`Error fetching auth user ${member.user_id}:`, authError)
        }

        const isBanned = authUser?.user?.banned_until
          ? new Date(authUser.user.banned_until) > new Date()
          : false

        return {
          id: member.user_id,
          full_name: profileItem?.full_name || 'Unknown',
          avatar_url: profileItem?.avatar_url,
          email: profileItem?.email || null,
          phone: profileItem?.phone || null,
          organization_id: organizationId,
          user_id: member.user_id,
          role: userRole?.role || member.role || 'viewer',
          is_banned: isBanned,
          profile_id: member.profile_id || null,
          profile_name: orgProfile?.name || null,
        }
      })
    )

    return new Response(JSON.stringify(teamMembers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in get-team-members:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
