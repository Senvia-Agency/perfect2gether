import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { EcommerceProduct, CreateProductInput, UpdateProductInput } from '@/types/ecommerce';

export function useEcommerceProducts() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['ecommerce-products', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('ecommerce_products')
        .select(`
          *,
          category:product_categories(id, name, slug)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EcommerceProduct[];
    },
    enabled: !!organizationId,
  });
}

export function useActiveEcommerceProducts() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['ecommerce-products', organizationId, 'active'],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('ecommerce_products')
        .select(`
          *,
          category:product_categories(id, name, slug)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as EcommerceProduct[];
    },
    enabled: !!organizationId,
  });
}

export function useEcommerceProduct(productId: string | undefined) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['ecommerce-products', organizationId, productId],
    queryFn: async () => {
      if (!organizationId || !productId) return null;

      const { data, error } = await supabase
        .from('ecommerce_products')
        .select(`
          *,
          category:product_categories(id, name, slug)
        `)
        .eq('id', productId)
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;
      return data as EcommerceProduct;
    },
    enabled: !!organizationId && !!productId,
  });
}

export function useLowStockProducts() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['ecommerce-products', organizationId, 'low-stock'],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get products where stock_quantity <= low_stock_threshold
      const { data, error } = await supabase
        .from('ecommerce_products')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('track_inventory', true)
        .order('stock_quantity', { ascending: true });

      if (error) throw error;
      
      // Filter in JS since we can't do column comparison directly
      return (data as EcommerceProduct[]).filter(
        p => p.stock_quantity <= p.low_stock_threshold
      );
    },
    enabled: !!organizationId,
  });
}

export function useCreateEcommerceProduct() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      if (!organization?.id) throw new Error('No organization');

      // Remove is_ecommerce from input since it's no longer needed
      const { is_ecommerce, ...productData } = input as CreateProductInput & { is_ecommerce?: boolean };

      const { data, error } = await supabase
        .from('ecommerce_products')
        .insert({
          ...productData,
          organization_id: organization.id,
          tags: productData.tags || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-products'] });
      toast.success('Produto criado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating product:', error);
      toast.error('Erro ao criar produto');
    },
  });
}

export function useUpdateEcommerceProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProductInput) => {
      const { data, error } = await supabase
        .from('ecommerce_products')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-products'] });
      toast.success('Produto atualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating product:', error);
      toast.error('Erro ao atualizar produto');
    },
  });
}

export function useDeleteEcommerceProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('ecommerce_products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-products'] });
      toast.success('Produto eliminado');
    },
    onError: (error: Error) => {
      console.error('Error deleting product:', error);
      toast.error('Erro ao eliminar produto');
    },
  });
}
