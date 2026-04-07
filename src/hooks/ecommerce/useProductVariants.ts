import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProductVariant, CreateVariantInput, UpdateVariantInput, ProductVariantOptions } from '@/types/ecommerce';

export function useProductVariants(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Parse options from JSONB
      return (data || []).map(v => ({
        ...v,
        options: (v.options as ProductVariantOptions) || {},
      })) as ProductVariant[];
    },
    enabled: !!productId,
  });
}

export function useActiveProductVariants(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-variants', productId, 'active'],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(v => ({
        ...v,
        options: (v.options as ProductVariantOptions) || {},
      })) as ProductVariant[];
    },
    enabled: !!productId,
  });
}

export function useCreateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVariantInput) => {
      const { data, error } = await supabase
        .from('product_variants')
        .insert({
          ...input,
          options: input.options || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', variables.product_id] });
      toast.success('Variante criada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating variant:', error);
      toast.error('Erro ao criar variante');
    },
  });
}

export function useUpdateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateVariantInput) => {
      const { data, error } = await supabase
        .from('product_variants')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', data.product_id] });
      toast.success('Variante atualizada');
    },
    onError: (error: Error) => {
      console.error('Error updating variant:', error);
      toast.error('Erro ao atualizar variante');
    },
  });
}

export function useDeleteVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ variantId, productId }: { variantId: string; productId: string }) => {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);

      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
      toast.success('Variante eliminada');
    },
    onError: (error: Error) => {
      console.error('Error deleting variant:', error);
      toast.error('Erro ao eliminar variante');
    },
  });
}
