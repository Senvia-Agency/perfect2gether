import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ClientFieldsSettings, DEFAULT_CLIENT_FIELDS_SETTINGS } from '@/types/clients';
import { Json } from '@/integrations/supabase/types';

export function useClientFieldsSettings() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['client_fields_settings', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return DEFAULT_CLIENT_FIELDS_SETTINGS;

      const { data, error } = await supabase
        .from('organizations')
        .select('client_fields_settings')
        .eq('id', organization.id)
        .single();

      if (error) throw error;
      
      // Merge with defaults to ensure all fields exist
      const settings = data?.client_fields_settings as unknown as ClientFieldsSettings | null;
      if (!settings) return DEFAULT_CLIENT_FIELDS_SETTINGS;
      
      return {
        ...DEFAULT_CLIENT_FIELDS_SETTINGS,
        ...settings,
      };
    },
    enabled: !!organization?.id,
  });
}

export function useUpdateClientFieldsSettings() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: ClientFieldsSettings) => {
      if (!organization?.id) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from('organizations')
        .update({ client_fields_settings: settings as unknown as Json })
        .eq('id', organization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_fields_settings'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({
        title: 'Guardado',
        description: 'Definições de campos atualizadas com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error updating client fields settings:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar as definições.',
        variant: 'destructive',
      });
    },
  });
}
