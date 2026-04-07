import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { DiscountCode, CreateDiscountInput, UpdateDiscountInput, DiscountType } from '@/types/ecommerce';

export function useDiscountCodes() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['discount-codes', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DiscountCode[];
    },
    enabled: !!organizationId,
  });
}

export function useActiveDiscountCodes() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['discount-codes', organizationId, 'active'],
    queryFn: async () => {
      if (!organizationId) return [];

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter by max uses
      return (data as DiscountCode[]).filter(
        code => !code.max_uses || code.uses_count < code.max_uses
      );
    },
    enabled: !!organizationId,
  });
}

export function useValidateDiscountCode() {
  const { organization } = useAuth();

  return useMutation({
    mutationFn: async ({
      code,
      subtotal,
    }: {
      code: string;
      subtotal: number;
    }): Promise<{ valid: boolean; discount: DiscountCode | null; error?: string }> => {
      if (!organization?.id) {
        return { valid: false, discount: null, error: 'No organization' };
      }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        return { valid: false, discount: null, error: 'Erro ao validar código' };
      }

      if (!data) {
        return { valid: false, discount: null, error: 'Código inválido' };
      }

      const discount = data as DiscountCode;

      // Check dates
      if (discount.starts_at && new Date(discount.starts_at) > new Date(now)) {
        return { valid: false, discount: null, error: 'Código ainda não está ativo' };
      }

      if (discount.expires_at && new Date(discount.expires_at) < new Date(now)) {
        return { valid: false, discount: null, error: 'Código expirado' };
      }

      // Check max uses
      if (discount.max_uses && discount.uses_count >= discount.max_uses) {
        return { valid: false, discount: null, error: 'Código atingiu o limite de utilizações' };
      }

      // Check min purchase
      if (discount.min_purchase && subtotal < discount.min_purchase) {
        return { 
          valid: false, 
          discount: null, 
          error: `Compra mínima: ${discount.min_purchase.toFixed(2)}€` 
        };
      }

      return { valid: true, discount };
    },
  });
}

export function useCalculateDiscount() {
  return (discount: DiscountCode, subtotal: number): number => {
    switch (discount.type) {
      case 'percentage':
        return (subtotal * discount.value) / 100;
      case 'fixed_amount':
        return Math.min(discount.value, subtotal);
      case 'free_shipping':
        return 0; // Handled separately in shipping calculation
      default:
        return 0;
    }
  };
}

export function useCreateDiscountCode() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDiscountInput) => {
      if (!organization?.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('discount_codes')
        .insert({
          ...input,
          code: input.code.toUpperCase(),
          organization_id: organization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      toast.success('Código de desconto criado');
    },
    onError: (error: Error) => {
      console.error('Error creating discount code:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um código com este nome');
      } else {
        toast.error('Erro ao criar código de desconto');
      }
    },
  });
}

export function useUpdateDiscountCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateDiscountInput) => {
      const updates = {
        ...input,
        ...(input.code && { code: input.code.toUpperCase() }),
      };

      const { data, error } = await supabase
        .from('discount_codes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      toast.success('Código de desconto atualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating discount code:', error);
      toast.error('Erro ao atualizar código de desconto');
    },
  });
}

export function useIncrementDiscountUse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (discountId: string) => {
      const { data: current } = await supabase
        .from('discount_codes')
        .select('uses_count')
        .eq('id', discountId)
        .single();

      const { data, error } = await supabase
        .from('discount_codes')
        .update({ uses_count: (current?.uses_count || 0) + 1 })
        .eq('id', discountId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
    },
  });
}

export function useDeleteDiscountCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (discountId: string) => {
      const { error } = await supabase
        .from('discount_codes')
        .delete()
        .eq('id', discountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      toast.success('Código de desconto eliminado');
    },
    onError: (error: Error) => {
      console.error('Error deleting discount code:', error);
      toast.error('Erro ao eliminar código de desconto');
    },
  });
}
