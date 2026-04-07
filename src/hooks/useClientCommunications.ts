import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ClientCommunication, CommunicationType, CommunicationDirection } from '@/types/communications';

export function useClientCommunications(clientId: string | null) {
  return useQuery({
    queryKey: ['client-communications', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_communications')
        .select('*')
        .eq('client_id', clientId)
        .order('occurred_at', { ascending: false });

      if (error) {
        console.error('Error fetching client communications:', error);
        throw error;
      }

      return data as ClientCommunication[];
    },
    enabled: !!clientId,
  });
}

export interface CreateCommunicationData {
  client_id: string;
  type: CommunicationType;
  direction?: CommunicationDirection | null;
  subject?: string | null;
  content?: string | null;
  duration_seconds?: number | null;
  occurred_at?: string;
}

export function useCreateCommunication() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateCommunicationData) => {
      if (!organization?.id) {
        throw new Error('No organization selected');
      }

      const { data: result, error } = await supabase
        .from('client_communications')
        .insert({
          ...data,
          organization_id: organization.id,
          occurred_at: data.occurred_at || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating communication:', error);
        throw error;
      }

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidar todas as queries de comunicações para garantir refresh do timeline
      queryClient.invalidateQueries({ 
        queryKey: ['client-communications'],
        refetchType: 'active'
      });
    },
  });
}

export function useDeleteCommunication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('client_communications')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting communication:', error);
        throw error;
      }

      return { id, clientId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-communications', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-history'] });
    },
  });
}
