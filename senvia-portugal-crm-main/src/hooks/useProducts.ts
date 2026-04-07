import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types/proposals';

export function useProducts() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['products', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organization!.id)
        .order('name');
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!organization?.id,
  });
}

export function useActiveProducts() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['products', 'active', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organization!.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; price?: number; is_recurring?: boolean; tax_value?: number | null; tax_exemption_reason?: string | null }) => {
      const { error } = await supabase
        .from('products')
        .insert({
          organization_id: organization!.id,
          name: data.name,
          description: data.description || null,
          price: data.price || null,
          is_recurring: data.is_recurring || false,
          tax_value: data.tax_value ?? null,
          tax_exemption_reason: data.tax_exemption_reason || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto criado', description: 'O produto foi adicionado com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível criar o produto.', variant: 'destructive' });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string | null; price?: number | null; is_active?: boolean; is_recurring?: boolean; tax_value?: number | null; tax_exemption_reason?: string | null; invoicexpress_id?: number | null }) => {
      const { error } = await supabase
        .from('products')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;

      // Sync to InvoiceXpress if product has invoicexpress_id
      const ixId = data.invoicexpress_id;
      if (ixId && organization?.id) {
        try {
          const response = await supabase.functions.invoke('update-invoicexpress-item', {
            body: {
              organization_id: organization.id,
              invoicexpress_id: ixId,
              name: data.name,
              description: data.description,
              unit_price: data.price,
              tax_value: data.tax_value,
            },
          });
          if (response.error) throw new Error(response.error.message);
          return { synced: true, warning: response.data?.warning };
        } catch (syncErr) {
          console.warn('InvoiceXpress sync failed:', syncErr);
          return { synced: false };
        }
      }
      return { synced: null };
    },
    onSuccess: (_result) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      const result = _result as { synced: boolean | null; warning?: string } | undefined;
      if (result?.synced === true) {
        toast({ title: 'Produto atualizado', description: result.warning || 'Sincronizado com InvoiceXpress.' });
      } else if (result?.synced === false) {
        toast({ title: 'Produto atualizado', description: 'Guardado localmente, mas falhou a sincronização com InvoiceXpress.', variant: 'destructive' });
      } else {
        toast({ title: 'Produto atualizado', description: 'As alterações foram guardadas.' });
      }
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível atualizar o produto.', variant: 'destructive' });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto eliminado', description: 'O produto foi removido.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível eliminar o produto.', variant: 'destructive' });
    },
  });
}
