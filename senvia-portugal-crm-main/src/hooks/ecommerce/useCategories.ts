import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ProductCategory, CreateCategoryInput, UpdateCategoryInput } from '@/types/ecommerce';

export function useCategories() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['product-categories', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as ProductCategory[];
    },
    enabled: !!organizationId,
  });
}

export function useActiveCategories() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['product-categories', organizationId, 'active'],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as ProductCategory[];
    },
    enabled: !!organizationId,
  });
}

export function useCategory(categoryId: string | undefined) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['product-categories', organizationId, categoryId],
    queryFn: async () => {
      if (!organizationId || !categoryId) return null;

      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('id', categoryId)
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;
      return data as ProductCategory;
    },
    enabled: !!organizationId && !!categoryId,
  });
}

export function useCreateCategory() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      if (!organization?.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('product_categories')
        .insert({
          ...input,
          organization_id: organization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Categoria criada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating category:', error);
      toast.error('Erro ao criar categoria');
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCategoryInput) => {
      const { data, error } = await supabase
        .from('product_categories')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Categoria atualizada');
    },
    onError: (error: Error) => {
      console.error('Error updating category:', error);
      toast.error('Erro ao atualizar categoria');
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Categoria eliminada');
    },
    onError: (error: Error) => {
      console.error('Error deleting category:', error);
      toast.error('Erro ao eliminar categoria');
    },
  });
}
