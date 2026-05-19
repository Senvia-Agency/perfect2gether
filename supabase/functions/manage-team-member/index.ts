import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageMemberRequest {
  action: 'change_password' | 'change_role' | 'toggle_status' | 'update_profile' | 'delete_member' | 'enroll_mfa' | 'verify_mfa' | 'unenroll_mfa';
  user_id: string;
  new_password?: string;
  new_role?: 'admin' | 'viewer' | 'salesperson';
  profile_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  // MFA fields
  factor_id?: string;
  code?: string;
  user_email?: string;
  user_password?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's token to verify they're authenticated
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user: currentUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !currentUser) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Check if current user is admin
    const { data: currentUserRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id);

    if (rolesError) {
      console.error('Roles error:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = currentUserRoles?.some(r => r.role === 'admin' || r.role === 'super_admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem gerir membros' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ManageMemberRequest = await req.json();
    const { action, user_id, new_password, new_role, profile_id, full_name, email, phone, factor_id, code, user_email, user_password } = body;

    console.log(`Action: ${action}, Target user: ${user_id}`);

    const isSuperAdmin = currentUserRoles?.some(r => r.role === 'super_admin');

    let sharedOrgId: string;

    if (isSuperAdmin) {
      // Super admins can manage any org's members - find target's org directly
      const { data: targetMemberships, error: targetError } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .limit(1);

      if (targetError || !targetMemberships?.length) {
        console.error('Target membership error:', targetError);
        return new Response(
          JSON.stringify({ error: 'Membro não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      sharedOrgId = targetMemberships[0].organization_id;
    } else {
      // Regular admin: verify shared org membership
      const { data: currentMemberships, error: memberError } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', currentUser.id)
        .eq('is_active', true);

      if (memberError || !currentMemberships?.length) {
        console.error('Membership error:', memberError);
        return new Response(
          JSON.stringify({ error: 'Organização não encontrada' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const currentOrgIds = currentMemberships.map(m => m.organization_id);

      const { data: targetMemberships, error: targetError } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .in('organization_id', currentOrgIds);

      if (targetError || !targetMemberships?.length) {
        console.error('Target membership error:', targetError);
        return new Response(
          JSON.stringify({ error: 'Membro não encontrado nesta organização' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      sharedOrgId = targetMemberships[0].organization_id;
    }

    // Prevent admin from modifying themselves for certain actions
    if (user_id === currentUser.id && (action === 'toggle_status' || action === 'change_role' || action === 'delete_member')) {
      return new Response(
        JSON.stringify({ error: 'Não pode modificar o seu próprio estado ou perfil' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper: redistribute leads from a deactivated user to active members via round-robin
    async function redistributeLeads(deactivatedUserId: string, orgId: string) {
      try {
        // Get leads assigned to this user in this org
        const { data: leadsToReassign } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('assigned_to', deactivatedUserId)
          .eq('organization_id', orgId);

        if (!leadsToReassign || leadsToReassign.length === 0) {
          console.log('No leads to redistribute');
          return;
        }

        // Get org sales settings
        const { data: orgData } = await supabaseAdmin
          .from('organizations')
          .select('sales_settings')
          .eq('id', orgId)
          .single();

        const salesSettings = (orgData?.sales_settings as any) || {};

        // Get active members (excluding the deactivated user)
        let membersQuery = supabaseAdmin
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .neq('user_id', deactivatedUserId);

        if (salesSettings.exclude_admins_from_assignment) {
          membersQuery = membersQuery.neq('role', 'admin');
        }

        const { data: activeMembers } = await membersQuery.order('joined_at', { ascending: true });

        if (!activeMembers || activeMembers.length === 0) {
          console.log('No active members to reassign leads to');
          return;
        }

        let currentIndex = salesSettings.round_robin_index || 0;

        for (const lead of leadsToReassign) {
          const safeIndex = currentIndex % activeMembers.length;
          const newAssignee = activeMembers[safeIndex].user_id;

          await supabaseAdmin
            .from('leads')
            .update({ assigned_to: newAssignee })
            .eq('id', lead.id);

          currentIndex = (safeIndex + 1) % activeMembers.length;
        }

        // Update round_robin_index
        await supabaseAdmin
          .from('organizations')
          .update({ sales_settings: { ...salesSettings, round_robin_index: currentIndex } })
          .eq('id', orgId);

        console.log(`Redistributed ${leadsToReassign.length} leads from user ${deactivatedUserId}`);
      } catch (err) {
        console.error('Lead redistribution error:', err);
      }
    }

    // Execute the action
    switch (action) {
      case 'change_password': {
        if (!new_password || new_password.length < 6) {
          return new Response(
            JSON.stringify({ error: 'A password deve ter pelo menos 6 caracteres' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: new_password,
        });

        if (updateError) {
          console.error('Password update error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao alterar password' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Password changed for user ${user_id}`);
        break;
      }

      case 'change_role': {
        if (!new_role || !['admin', 'viewer', 'salesperson'].includes(new_role)) {
          return new Response(
            JSON.stringify({ error: 'Perfil inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete existing roles (except super_admin)
        const { error: deleteError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)
          .neq('role', 'super_admin');

        if (deleteError) {
          console.error('Role delete error:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Erro ao alterar perfil' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Insert new role
        const { error: insertError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id, role: new_role });

        if (insertError) {
          console.error('Role insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Erro ao alterar perfil' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update organization_members with profile_id and role
        const { error: memberUpdateError } = await supabaseAdmin
          .from('organization_members')
          .update({ 
            role: new_role,
            profile_id: profile_id || null 
          })
          .eq('user_id', user_id)
          .eq('organization_id', sharedOrgId);

        if (memberUpdateError) {
          console.error('Member profile update error:', memberUpdateError);
        }

        console.log(`Role changed to ${new_role} (profile_id: ${profile_id || 'none'}) for user ${user_id}`);
        break;
      }

      case 'toggle_status': {
        // Get current user status
        const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

        if (getUserError || !userData.user) {
          console.error('Get user error:', getUserError);
          return new Response(
            JSON.stringify({ error: 'Erro ao obter estado do utilizador' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isBanned = userData.user.banned_until && new Date(userData.user.banned_until) > new Date();

        if (isBanned) {
          // Unban user
          const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            ban_duration: 'none',
          });

          if (unbanError) {
            console.error('Unban error:', unbanError);
            return new Response(
              JSON.stringify({ error: 'Erro ao ativar utilizador' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Sync organization_members.is_active
          await supabaseAdmin
            .from('organization_members')
            .update({ is_active: true })
            .eq('user_id', user_id)
            .eq('organization_id', sharedOrgId);

          console.log(`User ${user_id} activated`);
        } else {
          // Ban user for 100 years (effectively permanent)
          const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            ban_duration: '876600h', // 100 years
          });

          if (banError) {
            console.error('Ban error:', banError);
            return new Response(
              JSON.stringify({ error: 'Erro ao desativar utilizador' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Sync organization_members.is_active
          await supabaseAdmin
            .from('organization_members')
            .update({ is_active: false })
            .eq('user_id', user_id)
            .eq('organization_id', sharedOrgId);

          console.log(`User ${user_id} deactivated`);

          // Redistribute leads from deactivated user
          await redistributeLeads(user_id, sharedOrgId);
        }
        break;
      }

      case 'update_profile': {
        const updateData: Record<string, string> = {};
        if (full_name !== undefined) updateData.full_name = full_name.trim();
        if (email !== undefined) updateData.email = email.trim();
        if (phone !== undefined) updateData.phone = phone.trim();

        if (Object.keys(updateData).length === 0) {
          return new Response(
            JSON.stringify({ error: 'Nenhum campo para atualizar' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update(updateData)
          .eq('id', user_id);

        if (profileUpdateError) {
          console.error('Profile update error:', profileUpdateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar dados' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Profile updated for user ${user_id}:`, Object.keys(updateData));
        break;
      }

      case 'delete_member': {
        // Remove from organization_members
        const { error: deleteMemberError } = await supabaseAdmin
          .from('organization_members')
          .delete()
          .eq('user_id', user_id)
          .eq('organization_id', sharedOrgId);

        if (deleteMemberError) {
          console.error('Delete member error:', deleteMemberError);
          return new Response(
            JSON.stringify({ error: 'Erro ao remover membro da organização' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Remove user roles (except super_admin)
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)
          .neq('role', 'super_admin');

        // Clear organization_id from profile
        await supabaseAdmin
          .from('profiles')
          .update({ organization_id: null })
          .eq('id', user_id);

        // Ban the user so they can't log in
        await supabaseAdmin.auth.admin.updateUserById(user_id, {
          ban_duration: '876600h',
        });

        // Redistribute leads from deleted member
        await redistributeLeads(user_id, sharedOrgId);

        console.log(`Member ${user_id} deleted from org ${sharedOrgId}`);
        break;
      }

      case 'enroll_mfa': {
        // Admin enrolls MFA for a user — no password needed
        // Look up user's auth email
        const { data: enrollTarget, error: enrollTargetErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (enrollTargetErr || !enrollTarget?.user?.email) {
          return new Response(
            JSON.stringify({ error: 'Utilizador não encontrado ou sem email' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Remove any existing TOTP factors via admin API BEFORE generating session
        // (aal1 sessions can't unenroll verified factors, so we use the admin API)
        const { data: priorFactors } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user_id });
        if (priorFactors?.factors && priorFactors.factors.length > 0) {
          for (const f of priorFactors.factors) {
            if (f.factor_type === 'totp') {
              await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user_id });
            }
          }
        }

        // Generate a magic link to obtain a session token without the user's password
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: enrollTarget.user.email,
        });

        if (linkError || !linkData?.properties?.hashed_token) {
          console.error('MFA generateLink error:', linkError);
          return new Response(
            JSON.stringify({ error: `Erro ao gerar sessão: ${linkError?.message || 'Unknown'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify the OTP to get a user session
        const enrollUserClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
        });

        const { data: otpData, error: otpError } = await enrollUserClient.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: 'magiclink',
        });

        if (otpError || !otpData.session) {
          console.error('MFA OTP verify error:', otpError);
          return new Response(
            JSON.stringify({ error: `Erro ao criar sessão: ${otpError?.message || 'Unknown'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create a client with the user's session to enroll MFA
        const mfaClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${otpData.session.access_token}` } },
          auth: { persistSession: false },
        });

        // Enroll new TOTP factor
        const { data: enrollData, error: enrollError } = await mfaClient.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Perfect2Gether',
          issuer: 'Perfect2Gether',
        });

        if (enrollError || !enrollData) {
          console.error('MFA enroll error:', enrollError);
          return new Response(
            JSON.stringify({ error: `Erro ao ativar MFA: ${enrollError?.message || 'Unknown'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`MFA enrolled for user ${user_id}, factor: ${enrollData.id}`);

        return new Response(
          JSON.stringify({
            success: true,
            factor_id: enrollData.id,
            totp_uri: enrollData.totp.uri,
            qr_code: enrollData.totp.qr_code,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify_mfa': {
        // Admin verifies the TOTP code to complete enrollment — no password needed
        if (!factor_id || !code) {
          return new Response(
            JSON.stringify({ error: 'factor_id e code são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Look up user's auth email
        const { data: verifyTarget, error: verifyTargetErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (verifyTargetErr || !verifyTarget?.user?.email) {
          return new Response(
            JSON.stringify({ error: 'Utilizador não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate magic link to get session
        const { data: verifyLinkData, error: verifyLinkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: verifyTarget.user.email,
        });

        if (verifyLinkErr || !verifyLinkData?.properties?.hashed_token) {
          return new Response(
            JSON.stringify({ error: `Erro ao gerar sessão: ${verifyLinkErr?.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const verifyUserClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
        });

        const { data: verifyOtpData, error: verifyOtpErr } = await verifyUserClient.auth.verifyOtp({
          token_hash: verifyLinkData.properties.hashed_token,
          type: 'magiclink',
        });

        if (verifyOtpErr || !verifyOtpData.session) {
          return new Response(
            JSON.stringify({ error: `Erro ao criar sessão: ${verifyOtpErr?.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const verifyMfaClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${verifyOtpData.session.access_token}` } },
          auth: { persistSession: false },
        });

        // Create challenge and verify
        const { data: challengeData, error: challengeError } = await verifyMfaClient.auth.mfa.challenge({
          factorId: factor_id,
        });

        if (challengeError || !challengeData) {
          console.error('MFA challenge error:', challengeError);
          return new Response(
            JSON.stringify({ error: `Erro ao criar challenge: ${challengeError?.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: verifyError } = await verifyMfaClient.auth.mfa.verify({
          factorId: factor_id,
          challengeId: challengeData.id,
          code: code,
        });

        if (verifyError) {
          console.error('MFA verify error:', verifyError);
          return new Response(
            JSON.stringify({ error: 'Código inválido. Verifique o código na aplicação de autenticação.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`MFA verified for user ${user_id}, factor: ${factor_id}`);
        break;
      }

      case 'unenroll_mfa': {
        // Admin removes MFA from a user — use admin API to list factors and remove
        const { data: targetUser, error: targetError } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (targetError || !targetUser?.user) {
          return new Response(
            JSON.stringify({ error: 'Utilizador não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // List MFA factors via admin API
        const { data: factors, error: factorsError } = await supabaseAdmin.auth.admin.mfa.listFactors({
          userId: user_id,
        });

        if (factorsError) {
          console.error('List factors error:', factorsError);
          return new Response(
            JSON.stringify({ error: 'Erro ao listar fatores MFA' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete all TOTP factors
        const totpFactors = factors?.factors?.filter((f: any) => f.factor_type === 'totp') || [];
        for (const factor of totpFactors) {
          const { error: deleteError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
            userId: user_id,
            factorId: factor.id,
          });
          if (deleteError) {
            console.error(`Error deleting factor ${factor.id}:`, deleteError);
          }
        }

        console.log(`MFA unenrolled for user ${user_id}, removed ${totpFactors.length} factors`);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true }),
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
