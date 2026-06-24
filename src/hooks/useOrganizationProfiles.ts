import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ── Action labels ──
export const ACTION_LABELS: Record<string, string> = {
  view: 'Ver',
  add: 'Adicionar',
  edit: 'Editar',
  delete: 'Eliminar',
  assign: 'Atribuir',
  export: 'Exportar',
  import: 'Importar',
  create: 'Criar',
  send: 'Enviar',
  issue: 'Emitir',
  cancel: 'Cancelar',
  submit: 'Submeter',
  approve: 'Aprovar',
  manage: 'Gerir',
};

// ── Schema definition ──
export interface SubareaSchema {
  label: string;
  actions: string[];
  /**
   * Optional per-subarea overrides for action labels. Lets the same action key
   * (e.g. `add`, `delete`) read differently depending on context, e.g. for
   * Clientes: list.add = "Adicionar Cliente" but communications.add = "Acrescentar à ficha".
   */
  actionLabels?: Record<string, string>;
}

export interface ModuleSchema {
  label: string;
  subareas: Record<string, SubareaSchema>;
}

export const MODULE_SCHEMA: Record<string, ModuleSchema> = {
  leads: {
    label: 'Leads',
    subareas: {
      kanban: { label: 'Kanban / Lista', actions: ['view', 'add', 'edit', 'delete', 'assign'] },
      export: { label: 'Importar / Exportar', actions: ['export', 'import'] },
    },
  },
  prospects: {
    label: 'Prospects',
    subareas: {
      list: { label: 'Lista de Prospects', actions: ['view', 'add', 'edit', 'delete', 'assign'] },
      import_export: { label: 'Importar / Exportar', actions: ['import', 'export'] },
      generate: { label: 'Geração Automática', actions: ['manage'] },
    },
  },
  clients: {
    label: 'Clientes',
    subareas: {
      list: {
        label: 'Lista de Clientes',
        actions: ['view', 'add', 'edit', 'delete'],
        actionLabels: { add: 'Adicionar Cliente', edit: 'Editar Cliente', delete: 'Excluir Cliente' },
      },
      communications: {
        label: 'Ficha / Histórico',
        actions: ['view', 'add', 'delete'],
        actionLabels: { add: 'Acrescentar à ficha', delete: 'Remover da ficha' },
      },
      cpes: { label: 'CPEs', actions: ['view', 'add', 'edit', 'delete'] },
    },
  },
  proposals: {
    label: 'Propostas',
    subareas: {
      proposals: { label: 'Propostas', actions: ['view', 'create', 'edit', 'delete', 'send'] },
    },
  },
  sales: {
    label: 'Vendas',
    subareas: {
      sales: { label: 'Vendas', actions: ['view', 'create', 'edit', 'delete'] },
      payments: { label: 'Pagamentos', actions: ['view', 'add'] },
    },
  },
  finance: {
    label: 'Finanças',
    subareas: {
      summary: { label: 'Resumo', actions: ['view'] },
      invoices: { label: 'Faturas', actions: ['view', 'issue', 'cancel'] },
      expenses: { label: 'Despesas', actions: ['view', 'add', 'edit', 'delete'] },
      expense_categories: { label: 'Categorias de Despesa', actions: ['view', 'manage'] },
      payments: { label: 'Pagamentos', actions: ['view'] },
      requests: { label: 'Pedidos Internos', actions: ['view', 'submit', 'approve'] },
      commissions: { label: 'Comissões', actions: ['view', 'manage'] },
      bank_accounts: { label: 'Contas Bancárias', actions: ['view', 'manage'] },
    },
  },
  gestao: {
    label: 'Gestão',
    subareas: {
      reports: { label: 'Relatórios e Análises', actions: ['view'] },
      commissions: { label: 'Análise de Comissões', actions: ['view', 'manage'] },
      commitments: { label: 'Compromissos', actions: ['view', 'manage'] },
    },
  },
  calendar: {
    label: 'Agenda',
    subareas: {
      events: { label: 'Eventos', actions: ['view', 'create', 'edit', 'delete'] },
    },
  },
  marketing: {
    label: 'Marketing',
    subareas: {
      templates: { label: 'Templates', actions: ['view', 'create', 'edit', 'delete', 'send'] },
      campaigns: { label: 'Campanhas', actions: ['view', 'create', 'edit', 'delete', 'send'] },
      lists: { label: 'Listas de Contactos', actions: ['view', 'create', 'edit', 'delete', 'import'] },
      reports: { label: 'Relatórios', actions: ['view'] },
    },
  },
  portal_total_link: {
    label: 'Portal Total Link',
    subareas: {
      home: { label: 'Painel', actions: ['view'] },
      contratos: { label: 'Contratos', actions: ['view', 'edit'] },
      ids: { label: 'IDs', actions: ['view', 'edit'] },
      pendentes: { label: 'Pendentes', actions: ['view', 'edit'] },
      reclamacoes: { label: 'Reclamações', actions: ['view', 'add', 'edit'] },
      rh: { label: 'Recursos Humanos', actions: ['view', 'add', 'edit'] },
    },
  },
  ecommerce: {
    label: 'E-commerce',
    subareas: {
      products: { label: 'Produtos', actions: ['view', 'create', 'edit', 'delete'] },
      orders: { label: 'Pedidos', actions: ['view', 'edit'] },
      customers: { label: 'Clientes', actions: ['view', 'create', 'edit'] },
      inventory: { label: 'Inventário', actions: ['view', 'edit'] },
      discounts: { label: 'Descontos', actions: ['view', 'create', 'edit', 'delete'] },
    },
  },
  settings: {
    label: 'Definições',
    subareas: {
      general: { label: 'Geral', actions: ['view', 'edit'] },
      team: { label: 'Equipa', actions: ['view', 'manage'] },
      pipeline: { label: 'Pipeline', actions: ['view', 'edit'] },
      profiles: { label: 'Perfis', actions: ['view', 'manage'] },
      modules: { label: 'Módulos', actions: ['view', 'edit'] },
    },
  },
};

// ── Types ──
export type SubareaPermissions = Record<string, boolean>;
export interface ModulePermission {
  subareas: Record<string, SubareaPermissions>;
}
export type GranularPermissions = Record<string, ModulePermission>;

// Legacy flat format for backward compat
export interface LegacyModulePermission {
  view: boolean;
  edit: boolean;
  delete: boolean;
}
export type LegacyModulePermissions = Record<string, LegacyModulePermission>;

// Union: can be either format from DB
export type ModulePermissions = GranularPermissions;

export type SystemKey = 'p2g' | 'total_link';

export const SYSTEM_LABELS: Record<SystemKey, string> = {
  p2g: 'Perfect2Gether',
  total_link: 'Portal Total Link',
};

export const SYSTEM_DESCRIPTIONS: Record<SystemKey, string> = {
  p2g: 'CRM & Gestão Comercial',
  total_link: 'Portal Total Link',
};

export type DataScope = 'own' | 'team' | 'all';

export const DATA_SCOPE_LABELS: Record<DataScope, string> = {
  own: 'Próprio',
  team: 'Equipa',
  all: 'Tudo',
};

export const DATA_SCOPE_DESCRIPTIONS: Record<DataScope, string> = {
  own: 'Vê apenas os seus dados',
  team: 'Vê os seus + dados da equipa',
  all: 'Vê todos os dados da organização',
};

export interface ProfileDashboardWidget {
  type: string;
  is_visible: boolean;
}

export interface OrganizationProfile {
  id: string;
  organization_id: string;
  name: string;
  base_role: 'admin' | 'viewer' | 'salesperson';
  module_permissions: GranularPermissions;
  data_scope: DataScope;
  systems: SystemKey[];
  is_default: boolean;
  dashboard_widgets: ProfileDashboardWidget[] | null;
  created_at: string;
}

// ── Conversion from legacy ──
function isLegacyFormat(perms: any): boolean {
  if (!perms || typeof perms !== 'object') return false;
  const firstKey = Object.keys(perms)[0];
  if (!firstKey) return false;
  const val = perms[firstKey];
  return val && typeof val === 'object' && 'view' in val && !('subareas' in val);
}

export function convertLegacyToGranular(legacy: any): GranularPermissions {
  if (!legacy || typeof legacy !== 'object') return buildAllPermissions(true);
  if (!isLegacyFormat(legacy)) return legacy as GranularPermissions;

  const result: GranularPermissions = {};
  for (const [moduleKey, schema] of Object.entries(MODULE_SCHEMA)) {
    const old = legacy[moduleKey] as LegacyModulePermission | undefined;
    const canView = old?.view ?? false;
    const canEdit = old?.edit ?? false;
    const canDelete = old?.delete ?? false;

    const subareas: Record<string, SubareaPermissions> = {};
    for (const [subKey, subSchema] of Object.entries(schema.subareas)) {
      const actions: SubareaPermissions = {};
      for (const action of subSchema.actions) {
        if (action === 'view') actions[action] = canView;
        else if (action === 'delete') actions[action] = canDelete;
        else actions[action] = canEdit;
      }
      subareas[subKey] = actions;
    }
    result[moduleKey] = { subareas };
  }
  return result;
}

// ── Build helpers ──
export function buildAllPermissions(value: boolean): GranularPermissions {
  const result: GranularPermissions = {};
  for (const [moduleKey, schema] of Object.entries(MODULE_SCHEMA)) {
    const subareas: Record<string, SubareaPermissions> = {};
    for (const [subKey, subSchema] of Object.entries(schema.subareas)) {
      const actions: SubareaPermissions = {};
      for (const action of subSchema.actions) {
        actions[action] = value;
      }
      subareas[subKey] = actions;
    }
    result[moduleKey] = { subareas };
  }
  return result;
}

export function buildDefaultPermissions(role: string): GranularPermissions {
  if (role === 'admin') return buildAllPermissions(true);
  if (role === 'viewer') {
    const result: GranularPermissions = {};
    for (const [moduleKey, schema] of Object.entries(MODULE_SCHEMA)) {
      if (moduleKey === 'settings' || moduleKey === 'gestao') {
        const subareas: Record<string, SubareaPermissions> = {};
        for (const [subKey, subSchema] of Object.entries(schema.subareas)) {
          const actions: SubareaPermissions = {};
          for (const action of subSchema.actions) actions[action] = false;
          subareas[subKey] = actions;
        }
        result[moduleKey] = { subareas };
        continue;
      }
      const subareas: Record<string, SubareaPermissions> = {};
      for (const [subKey, subSchema] of Object.entries(schema.subareas)) {
        const actions: SubareaPermissions = {};
        for (const action of subSchema.actions) {
          actions[action] = action === 'view';
        }
        subareas[subKey] = actions;
      }
      result[moduleKey] = { subareas };
    }
    return result;
  }
  // salesperson
  const result: GranularPermissions = {};
  for (const [moduleKey, schema] of Object.entries(MODULE_SCHEMA)) {
    const subareas: Record<string, SubareaPermissions> = {};
    for (const [subKey, subSchema] of Object.entries(schema.subareas)) {
      const actions: SubareaPermissions = {};
      for (const action of subSchema.actions) {
        if (['finance', 'marketing', 'ecommerce', 'settings', 'gestao'].includes(moduleKey)) {
          actions[action] = false;
        } else if (action === 'delete') {
          actions[action] = false;
        } else {
          actions[action] = true;
        }
      }
      subareas[subKey] = actions;
    }
    result[moduleKey] = { subareas };
  }
  return result;
}

// ── Legacy compat exports ──
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_SCHEMA).map(([k, v]) => [k, v.label])
);

// ── Hook ──
export function useOrganizationProfiles() {
  const { organization } = useAuth();
  const organizationId = organization?.id;
  const queryClient = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['organization-profiles', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('organization_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        module_permissions: convertLegacyToGranular(d.module_permissions),
      })) as OrganizationProfile[];
    },
    enabled: !!organizationId,
  });

  const createProfile = useMutation({
    mutationFn: async (profile: { name: string; base_role: string; module_permissions: GranularPermissions; data_scope?: DataScope; systems?: SystemKey[]; dashboard_widgets?: ProfileDashboardWidget[] | null }) => {
      if (!organizationId) throw new Error('No organization');
      const { error } = await supabase
        .from('organization_profiles')
        .insert([{
          organization_id: organizationId,
          name: profile.name,
          base_role: profile.base_role,
          module_permissions: profile.module_permissions as any,
          data_scope: profile.data_scope || 'own',
          systems: profile.systems || ['p2g'],
          dashboard_widgets: profile.dashboard_widgets ?? null,
        }] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-profiles', organizationId] });
      toast.success('Perfil criado com sucesso');
    },
    onError: () => toast.error('Erro ao criar perfil'),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; base_role?: string; module_permissions?: GranularPermissions; data_scope?: DataScope; systems?: SystemKey[]; dashboard_widgets?: ProfileDashboardWidget[] | null }) => {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.base_role !== undefined) updateData.base_role = updates.base_role;
      if (updates.module_permissions !== undefined) updateData.module_permissions = updates.module_permissions;
      if (updates.data_scope !== undefined) updateData.data_scope = updates.data_scope;
      if (updates.systems !== undefined) updateData.systems = updates.systems;
      if (updates.dashboard_widgets !== undefined) updateData.dashboard_widgets = updates.dashboard_widgets;
      
      const { error } = await supabase
        .from('organization_profiles')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-profiles', organizationId] });
      toast.success('Perfil atualizado');
    },
    onError: () => toast.error('Erro ao atualizar perfil'),
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { data: members } = await supabase
        .from('organization_members')
        .select('id')
        .eq('profile_id', id)
        .limit(1);
      
      if (members && members.length > 0) {
        throw new Error('Este perfil está em uso por colaboradores da equipa');
      }

      const { error } = await supabase
        .from('organization_profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-profiles', organizationId] });
      toast.success('Perfil eliminado');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao eliminar perfil'),
  });

  return {
    profiles: profiles || [],
    isLoading,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}
