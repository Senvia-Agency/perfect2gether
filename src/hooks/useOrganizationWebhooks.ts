import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface OrganizationWebhook {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export function useOrganizationWebhooks() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['organization-webhooks', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('organization_webhooks' as any)
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_system', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as OrganizationWebhook[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateWebhook() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) => {
      if (!organization?.id) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from('organization_webhooks' as any)
        .insert({ organization_id: organization.id, name, url, is_active: true, is_system: false });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-webhooks'] });
      toast({ title: 'Webhook criado', description: 'O webhook foi adicionado com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível criar o webhook.', variant: 'destructive' });
    },
  });
}

export function useToggleWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('organization_webhooks' as any)
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organization_webhooks' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-webhooks'] });
      toast({ title: 'Webhook eliminado' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível eliminar o webhook.', variant: 'destructive' });
    },
  });
}
