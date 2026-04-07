import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivationHistoryEntry {
  id: string;
  activation_date: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  profile?: { full_name: string } | null;
}

export function useSaleActivationHistory(saleId: string | undefined) {
  const { organization, user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sale-activation-history', saleId, organization?.id],
    queryFn: async () => {
      if (!saleId || !organization?.id) return [];
      const { data, error } = await (supabase as any)
        .from('sale_activation_history')
        .select('id, activation_date, changed_by, notes, created_at, profiles:changed_by(full_name)')
        .eq('sale_id', saleId)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        profile: row.profiles || null,
      })) as ActivationHistoryEntry[];
    },
    enabled: !!saleId && !!organization?.id,
  });

  const addEntry = useMutation({
    mutationFn: async ({ activationDate, notes }: { activationDate: string; notes?: string }) => {
      if (!saleId || !organization?.id) throw new Error('Missing data');
      const { error } = await (supabase as any)
        .from('sale_activation_history')
        .insert({
          sale_id: saleId,
          organization_id: organization.id,
          activation_date: activationDate,
          changed_by: user?.id || null,
          notes: notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-activation-history', saleId] });
    },
  });

  return { history: query.data || [], isLoading: query.isLoading, addEntry };
}
