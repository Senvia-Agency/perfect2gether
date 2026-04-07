import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useSyncInvoiceXpressItems() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('sync-invoicexpress-items', {
        body: { organization_id: organization!.id },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data as { created: number; updated: number; total: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Sincronização concluída',
        description: `${data.created} criados, ${data.updated} atualizados (${data.total} itens no InvoiceXpress)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na sincronização',
        description: error.message || 'Não foi possível sincronizar com o InvoiceXpress.',
        variant: 'destructive',
      });
    },
  });
}
