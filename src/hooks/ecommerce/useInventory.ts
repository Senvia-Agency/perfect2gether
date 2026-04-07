import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { InventoryMovement, MovementType } from '@/types/ecommerce';

export function useInventoryMovements(options?: {
  productId?: string;
  variantId?: string;
  limit?: number;
}) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['inventory-movements', organizationId, options],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('inventory_movements')
        .select(`
          *,
          product:ecommerce_products(id, name),
          variant:product_variants(id, name, sku),
          creator:profiles(full_name)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (options?.productId) {
        query = query.eq('product_id', options.productId);
      }

      if (options?.variantId) {
        query = query.eq('variant_id', options.variantId);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InventoryMovement[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateInventoryMovement() {
  const { organization, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      variantId,
      quantity,
      type,
      referenceId,
      notes,
    }: {
      productId?: string;
      variantId?: string;
      quantity: number;
      type: MovementType;
      referenceId?: string;
      notes?: string;
    }) => {
      if (!organization?.id) throw new Error('No organization');

      // Create movement record
      const { data: movement, error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          organization_id: organization.id,
          product_id: productId,
          variant_id: variantId,
          quantity,
          type,
          reference_id: referenceId,
          notes,
          created_by: user?.id,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      // Update stock quantity
      if (variantId) {
        // Get current variant stock
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', variantId)
          .single();

        if (variant) {
          await supabase
            .from('product_variants')
            .update({ stock_quantity: (variant.stock_quantity || 0) + quantity })
            .eq('id', variantId);
        }
      } else if (productId) {
        // Get current product stock
        const { data: product } = await supabase
          .from('ecommerce_products')
          .select('stock_quantity')
          .eq('id', productId)
          .single();

        if (product) {
          await supabase
            .from('ecommerce_products')
            .update({ stock_quantity: (product.stock_quantity || 0) + quantity })
            .eq('id', productId);
        }
      }

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      toast.success('Movimento de stock registado');
    },
    onError: (error: Error) => {
      console.error('Error creating inventory movement:', error);
      toast.error('Erro ao registar movimento');
    },
  });
}

export function useAdjustStock() {
  const { organization, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      variantId,
      newQuantity,
      notes,
    }: {
      productId?: string;
      variantId?: string;
      newQuantity: number;
      notes?: string;
    }) => {
      if (!organization?.id) throw new Error('No organization');

      let currentQuantity = 0;

      if (variantId) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', variantId)
          .single();
        currentQuantity = variant?.stock_quantity || 0;
      } else if (productId) {
        const { data: product } = await supabase
          .from('ecommerce_products')
          .select('stock_quantity')
          .eq('id', productId)
          .single();
        currentQuantity = product?.stock_quantity || 0;
      }

      const adjustmentQuantity = newQuantity - currentQuantity;

      // Create adjustment movement
      const { data: movement, error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          organization_id: organization.id,
          product_id: productId,
          variant_id: variantId,
          quantity: adjustmentQuantity,
          type: 'adjustment',
          notes: notes || `Ajuste de stock: ${currentQuantity} → ${newQuantity}`,
          created_by: user?.id,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      // Update stock quantity
      if (variantId) {
        await supabase
          .from('product_variants')
          .update({ stock_quantity: newQuantity })
          .eq('id', variantId);
      } else if (productId) {
        await supabase
          .from('ecommerce_products')
          .update({ stock_quantity: newQuantity })
          .eq('id', productId);
      }

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      toast.success('Stock ajustado');
    },
    onError: (error: Error) => {
      console.error('Error adjusting stock:', error);
      toast.error('Erro ao ajustar stock');
    },
  });
}
