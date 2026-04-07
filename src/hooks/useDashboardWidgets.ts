import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  WidgetType, 
  NicheType, 
  getDefaultWidgetsForNiche, 
  filterWidgetsByModules,
  WIDGET_DEFINITIONS 
} from "@/lib/dashboard-templates";
import { usePermissions } from "@/hooks/usePermissions";

export interface DashboardWidget {
  id: string;
  organization_id: string;
  user_id: string;
  widget_type: WidgetType;
  position: number;
  is_visible: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export function useDashboardWidgets() {
  const { user, organization } = useAuth();
  const { profileDashboardWidgets, isAdmin, isSuperAdmin } = usePermissions();

  // Fallback: fetch admin profile widgets when user has no profile assigned
  const { data: adminProfileWidgets } = useQuery({
    queryKey: ['admin-profile-widgets', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { data } = await supabase
        .from('organization_profiles')
        .select('dashboard_widgets')
        .eq('organization_id', organization.id)
        .eq('base_role', 'admin')
        .limit(1)
        .maybeSingle();
      return (data as any)?.dashboard_widgets as Array<{ type: string; is_visible: boolean }> | null;
    },
    enabled: !!organization?.id && !profileDashboardWidgets && (isAdmin || isSuperAdmin),
  });

  // Get enabled modules from organization
  const enabledModules = (organization?.enabled_modules as Record<string, boolean>) || {
    sales: true,
    proposals: true,
    calendar: true,
    ecommerce: false,
  };

  const niche = (organization?.niche as NicheType) || 'generic';
  
  const defaultWidgetTypes = filterWidgetsByModules(
    getDefaultWidgetsForNiche(niche),
    enabledModules
  );

  // Convert to widget objects with positions
  const defaultWidgets: DashboardWidget[] = defaultWidgetTypes.map((type, index) => ({
    id: `default-${type}`,
    organization_id: organization?.id || '',
    user_id: user?.id || '',
    widget_type: type,
    position: index,
    is_visible: true,
    config: {},
    created_at: new Date().toISOString(),
  }));

  // Use profile widgets, or admin profile fallback, or niche defaults
  const rawProfileWidgets = profileDashboardWidgets || adminProfileWidgets;

  // Build profile-level widgets if available
  const profileWidgets: DashboardWidget[] | null = rawProfileWidgets
    ? rawProfileWidgets
        .filter(pw => {
          const def = WIDGET_DEFINITIONS[pw.type as WidgetType];
          if (!def) return false;
          if (def.requiredModule && enabledModules[def.requiredModule] === false) return false;
          return true;
        })
        .map((pw, index) => ({
          id: `profile-${pw.type}`,
          organization_id: organization?.id || '',
          user_id: user?.id || '',
          widget_type: pw.type as WidgetType,
          position: index,
          is_visible: pw.is_visible !== false, // default true when missing
          config: {},
          created_at: new Date().toISOString(),
        }))
    : null;

  // Priority: Profile defaults → Admin profile fallback → Niche defaults
  const widgets = profileWidgets || defaultWidgets;
  const visibleWidgets = widgets.filter(w => w.is_visible);

  return {
    widgets,
    visibleWidgets,
    isLoading: false,
    niche,
    enabledModules,
  };
}
