import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { ExpenseCategory } from '@/types/expenses';

export function useExpenseCategories() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['expense-categories', organizationId],
    queryFn: async (): Promise<ExpenseCategory[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching expense categories:', error);
        throw error;
      }

      return data as ExpenseCategory[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateExpenseCategory() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      if (!organization?.id) throw new Error('No organization');

      const { error } = await supabase.from('expense_categories').insert({
        organization_id: organization.id,
        name: data.name,
        description: data.description || null,
        color: data.color || '#6366f1',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast({ title: 'Categoria criada com sucesso!' });
    },
    onError: (error) => {
      console.error('Error creating expense category:', error);
      toast({
        title: 'Erro ao criar categoria',
        description: 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; color?: string }) => {
      const { error } = await supabase
        .from('expense_categories')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast({ title: 'Categoria atualizada!' });
    },
    onError: (error) => {
      console.error('Error updating expense category:', error);
      toast({
        title: 'Erro ao atualizar categoria',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expense_categories')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast({ title: 'Categoria removida!' });
    },
    onError: (error) => {
      console.error('Error deleting expense category:', error);
      toast({
        title: 'Erro ao remover categoria',
        variant: 'destructive',
      });
    },
  });
}
