import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateMemberRequest {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'viewer' | 'salesperson';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify who is calling
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user: currentUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !currentUser) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Utilizador não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get current user's organization
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', currentUser.id)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('Error getting profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Organização não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = profile.organization_id;

    // ---- Validate user limit based on subscription plan ----
    // Get org plan
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .single();

    const planId = orgData?.plan || 'starter';

    // Get plan limits from subscription_plans
    const { data: planData } = await supabaseAdmin
      .from('subscription_plans')
      .select('max_users, name')
      .eq('id', planId)
      .single();

    if (planData?.max_users !== null && planData?.max_users !== undefined) {
      // Count active members
      const { count: memberCount } = await supabaseAdmin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (memberCount !== null && memberCount >= planData.max_users) {
        return new Response(
          JSON.stringify({ 
            error: `Limite de ${planData.max_users} utilizadores atingido para o plano ${planData.name || planId}. Faça upgrade para adicionar mais membros.` 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if current user is admin of this organization
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .in('role', ['admin', 'super_admin']);

    if (roleError || !roleData || roleData.length === 0) {
      console.error('Error checking role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem adicionar membros' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, password, full_name, role, profile_id }: CreateMemberRequest & { profile_id?: string } = await req.json();

    // Validate input
    if (!email || !password || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A password deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['admin', 'viewer', 'salesperson'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Perfil inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating user: ${email} with role: ${role} for org: ${organizationId}`);

    const normalizedEmail = email.toLowerCase().trim();

    let userId: string;

    // Check if a profile with this email already exists (avoids expensive listUsers)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, organization_id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.organization_id === organizationId) {
        // Check if they're actually active in organization_members — they may have been deactivated
        const { data: activeMember } = await supabaseAdmin
          .from('organization_members')
          .select('is_active')
          .eq('user_id', existingProfile.id)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (activeMember?.is_active) {
          return new Response(
            JSON.stringify({ error: 'Este utilizador já pertence à sua organização' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // User belongs to org but is inactive (or has no member record) — reactivate
        userId = existingProfile.id;
        console.log(`Reactivating user ${userId} in organization ${organizationId}`);
        // Remove ban and apply the new password entered in the form
        await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none', password });
      } else if (existingProfile.organization_id) {
        return new Response(
          JSON.stringify({ error: 'Este email já está associado a outra organização' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // User exists but has no organization — add to this org
        userId = existingProfile.id;
        console.log(`Adding existing user ${userId} to organization ${organizationId}`);
      }
    } else {
      // Try to create new auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      });

      if (createError) {
        // If user already exists in auth but not in profiles, find them
        if (createError.message?.includes('already been registered')) {
          // Look up by email in auth
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
          // Fallback: search in auth by creating a dummy lookup
          return new Response(
            JSON.stringify({ error: 'Este email já está registado. Contacte o administrador.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar utilizador: ' + createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!newUser.user) {
        return new Response(
          JSON.stringify({ error: 'Erro ao criar utilizador' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      console.log(`New user created: ${userId}`);
    }

    console.log(`Processing user: ${userId}`);

    // Update profile with organization_id and full_name
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        organization_id: organizationId,
        full_name: full_name.trim()
      })
      .eq('id', userId);

    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError);
      // Don't fail completely, the user was created
    }

    // Replace any existing role for this user (keep super_admin untouched)
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .neq('role', 'super_admin');

    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: role });

    if (roleInsertError) {
      console.error('Error inserting role:', roleInsertError);
    }

    // Add to organization_members table
    const memberData: Record<string, unknown> = {
      user_id: userId,
      organization_id: organizationId,
      role: role,
      is_active: true,
      joined_at: new Date().toISOString(),
    };
    if (profile_id) memberData.profile_id = profile_id;

    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .upsert(memberData, { onConflict: 'user_id,organization_id' });

    if (memberError) {
      console.error('Error inserting organization member:', memberError);
    }

    console.log(`Successfully added team member: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        email: normalizedEmail
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
