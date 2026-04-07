import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ProposalFieldsSettings, DEFAULT_PROPOSAL_FIELDS_SETTINGS } from '@/types/field-settings';
import { Json } from '@/integrations/supabase/types';

export function useProposalFieldsSettings() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['proposal_fields_settings', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return DEFAULT_PROPOSAL_FIELDS_SETTINGS;

      const { data, error } = await supabase
        .from('organizations')
        .select('proposal_fields_settings')
        .eq('id', organization.id)
        .single();

      if (error) throw error;
      
      const settings = (data as any)?.proposal_fields_settings as ProposalFieldsSettings | null;
      if (!settings) return DEFAULT_PROPOSAL_FIELDS_SETTINGS;
      
      return { ...DEFAULT_PROPOSAL_FIELDS_SETTINGS, ...settings };
    },
    enabled: !!organization?.id,
  });
}

export function useUpdateProposalFieldsSettings() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: ProposalFieldsSettings) => {
      if (!organization?.id) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from('organizations')
        .update({ proposal_fields_settings: settings as unknown as Json })
        .eq('id', organization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal_fields_settings'] });
      toast({ title: 'Guardado', description: 'Definições de campos de propostas atualizadas.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível atualizar as definições.', variant: 'destructive' });
    },
  });
}
