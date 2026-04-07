import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamFilter } from '@/hooks/useTeamFilter';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import type { Lead, LeadStatus, LeadTemperature, LeadTipologia } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export function useLeads() {
  const { organization } = useAuth();
  const { effectiveUserIds } = useTeamFilter();
  
  return useQuery({
    queryKey: ['leads', organization?.id, effectiveUserIds],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      let query = supabase
        .from('leads')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      
      // Filter by user IDs (admin with filter, leader with team, or single user)
      // Include unassigned leads so they don't vanish during reassignment
      if (effectiveUserIds) {
        const orFilters = effectiveUserIds
          .map(id => `assigned_to.eq.${id}`)
          .concat('assigned_to.is.null')
          .join(',');
        query = query.or(orFilters);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!organization?.id,
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o estado do lead.',
        variant: 'destructive',
      });
      console.error('Error updating lead status:', error);
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ leadId, updates }: { leadId: string; updates: Partial<Omit<Lead, 'custom_data'>> & { custom_data?: Json } }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Sucesso',
        description: 'Lead atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o lead.',
        variant: 'destructive',
      });
      console.error('Error updating lead:', error);
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead eliminado',
        description: 'O lead foi eliminado permanentemente (RGPD).',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Não foi possível eliminar o lead.',
        variant: 'destructive',
      });
      console.error('Error deleting lead:', error);
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (leadData: {
      name: string;
      email: string;
      phone: string;
      source?: string;
      temperature?: LeadTemperature;
      value?: number;
      notes?: string;
      gdpr_consent: boolean;
      automation_enabled?: boolean;
      assigned_to?: string;
      tipologia?: LeadTipologia;
      consumo_anual?: number;
      company_nif?: string;
      company_name?: string;
      custom_data?: Record<string, unknown>;
    }) => {
      if (!organization?.id) throw new Error('Sem organização');

      let assignedTo = leadData.assigned_to || null;

      // Round-robin auto-assign if no assigned_to provided
      if (!assignedTo) {
        const { data: org } = await supabase
          .from('organizations')
          .select('sales_settings')
          .eq('id', organization.id)
          .single();

        const salesSettings = (org?.sales_settings as any) || {};
        if (salesSettings.auto_assign_leads) {
          let membersQuery = supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', organization.id)
            .eq('is_active', true);
          if (salesSettings.exclude_admins_from_assignment) {
            membersQuery = membersQuery.neq('role', 'admin');
          }
          const { data: members } = await membersQuery.order('joined_at', { ascending: true });

          if (members && members.length > 0) {
            const currentIndex = salesSettings.round_robin_index || 0;
            const safeIndex = currentIndex % members.length;
            assignedTo = members[safeIndex].user_id;
            const nextIndex = (safeIndex + 1) % members.length;

            await supabase
              .from('organizations')
              .update({
                sales_settings: { ...salesSettings, round_robin_index: nextIndex },
              })
              .eq('id', organization.id);
          }
        }
      }
      
      const { custom_data, ...rest } = leadData;
      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...rest,
          custom_data: custom_data as Json | undefined,
          assigned_to: assignedTo,
          organization_id: organization.id,
          status: 'new',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead criado',
        description: 'O lead foi adicionado com sucesso.',
      });
    },
    onError: (error: any) => {
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast({
        title: 'Erro ao criar lead',
        description: msg?.includes('row-level security')
          ? 'Erro de permissão. Tente sair e entrar novamente.'
          : 'Não foi possível criar o lead.',
        variant: 'destructive',
      });
      console.error('Error creating lead:', { message: msg, code: error?.code, details: error?.details, hint: error?.hint });
    },
  });
}

export function useLeadStats() {
  const { data: leads } = useLeads();
  const { data: stages } = usePipelineStages();
  
  if (!leads) {
    return {
      total: 0,
      new: 0,
      conversionRate: 0,
      pipelineValue: 0,
    };
  }

  // Get dynamic final stage keys
  const wonKey = stages?.find(s => s.is_final_positive)?.key || 'won';
  const lostKey = stages?.find(s => s.is_final_negative)?.key || 'lost';
  const firstStageKey = stages?.[0]?.key || 'new';
  
  const total = leads.length;
  const newLeads = leads.filter(l => l.status === firstStageKey).length;
  const won = leads.filter(l => l.status === wonKey).length;
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;
  const pipelineValue = leads
    .filter(l => ![wonKey, lostKey].includes(l.status || ''))
    .reduce((sum, l) => sum + (l.value || 0), 0);
  
  return {
    total,
    new: newLeads,
    conversionRate,
    pipelineValue,
  };
}
