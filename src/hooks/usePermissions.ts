import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  GranularPermissions,
  buildAllPermissions,
  convertLegacyToGranular,
  MODULE_SCHEMA,
  SystemKey,
} from '@/hooks/useOrganizationProfiles';

const FULL_PERMISSIONS = buildAllPermissions(true);

export function usePermissions() {
  const { roles, user, organization } = useAuth();

  const isSuperAdmin = roles.includes('super_admin');
  const isAdmin = roles.includes('admin') || isSuperAdmin;
  const isViewer = roles.includes('viewer') && !isAdmin;

  const { data: profileData } = useQuery({
    queryKey: ['user-profile-permissions', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return null;
      
      const { data: member } = await supabase
        .from('organization_members')
        .select('profile_id')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .single();
      
      if (!member?.profile_id) return null;

      const { data: profile } = await supabase
        .from('organization_profiles')
        .select('name, module_permissions, data_scope, systems, dashboard_widgets')
        .eq('id', member.profile_id)
        .single();

      if (!profile) return null;
      const p = profile as any;
      return {
        permissions: p.module_permissions ? convertLegacyToGranular(p.module_permissions) : null,
        dataScope: p.data_scope as string | null,
        systems: (p.systems as SystemKey[]) || ['p2g'],
        dashboardWidgets: p.dashboard_widgets as Array<{ type: string; is_visible: boolean }> | null,
        profileName: p.name as string | null,
      };
    },
    enabled: !!user?.id && !!organization?.id && !isSuperAdmin,
  });

  const modulePermissions = profileData?.permissions ?? null;
  const dataScope: 'own' | 'team' | 'all' = isSuperAdmin || isAdmin
    ? 'all'
    : (profileData?.dataScope as 'own' | 'team' | 'all') || 'own';

  const effectivePermissions: GranularPermissions = isSuperAdmin
    ? FULL_PERMISSIONS
    : modulePermissions || (isAdmin ? FULL_PERMISSIONS : buildDefaultFallback(isViewer));

  // Granular helper: can('finance', 'invoices', 'issue')
  function can(module: string, subarea: string, action: string): boolean {
    if (isSuperAdmin) return true;
    const mod = effectivePermissions[module];
    if (!mod?.subareas) return isAdmin;
    const sub = mod.subareas[subarea];
    if (!sub) return isAdmin;
    return sub[action] ?? isAdmin;
  }

  // Check if any subarea in module has view
  function canViewModule(module: string): boolean {
    if (isSuperAdmin || isAdmin) return true;
    const mod = effectivePermissions[module];
    if (!mod?.subareas) return false;
    return Object.values(mod.subareas).some(sub => sub.view === true);
  }

  return {
    // Granular
    can,
    canViewModule,
    modulePermissions: effectivePermissions,

    // Legacy compat
    canEditLeads: can('leads', 'kanban', 'edit'),
    canDeleteLeads: can('leads', 'kanban', 'delete'),
    canChangeLeadStatus: true,
    canAccessSettings: canViewModule('settings'),
    canManageTeam: isAdmin,
    canManageIntegrations: can('settings', 'general', 'edit'),

    isAdmin,
    isViewer,
    isSuperAdmin,
    dataScope,
    profileName: profileData?.profileName ?? null,
    systems: profileData?.systems || ['p2g'],
    hasSystem: (system: SystemKey) => {
      if (isSuperAdmin) return true;
      return (profileData?.systems || ['p2g']).includes(system);
    },
    profileDashboardWidgets: profileData?.dashboardWidgets ?? null,
  };
}

function buildDefaultFallback(isViewer: boolean): GranularPermissions {
  const result: GranularPermissions = {};
  for (const [moduleKey, schema] of Object.entries(MODULE_SCHEMA)) {
    const subareas: Record<string, Record<string, boolean>> = {};
    for (const [subKey, subSchema] of Object.entries(schema.subareas)) {
      const actions: Record<string, boolean> = {};
      for (const action of subSchema.actions) {
        if (moduleKey === 'settings' || moduleKey === 'gestao') {
          actions[action] = false;
        } else if (action === 'view') {
          actions[action] = true;
        } else {
          actions[action] = !isViewer;
        }
      }
      subareas[subKey] = actions;
    }
    result[moduleKey] = { subareas };
  }
  return result;
}
