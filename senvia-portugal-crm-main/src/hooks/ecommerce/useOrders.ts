import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Order, CreateOrderInput, UpdateOrderInput, OrderStatus, PaymentStatus, FulfillmentStatus, AddressData } from '@/types/ecommerce';
import type { Json } from '@/integrations/supabase/types';

export function useOrders(options?: {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  limit?: number;
}) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['orders', organizationId, options],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone),
          items:order_items(*)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.paymentStatus) {
        query = query.eq('payment_status', options.paymentStatus);
      }

      if (options?.fulfillmentStatus) {
        query = query.eq('fulfillment_status', options.fulfillmentStatus);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Parse address JSONBs
      return (data || []).map(order => ({
        ...order,
        shipping_address: order.shipping_address as unknown as AddressData | null,
        billing_address: order.billing_address as unknown as AddressData | null,
      })) as Order[];
    },
    enabled: !!organizationId,
  });
}

export function useOrder(orderId: string | undefined) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['orders', organizationId, orderId],
    queryFn: async () => {
      if (!organizationId || !orderId) return null;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, name, email, phone),
          items:order_items(*),
          shipments(*)
        `)
        .eq('id', orderId)
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        shipping_address: data.shipping_address as unknown as AddressData | null,
        billing_address: data.billing_address as unknown as AddressData | null,
      } as Order;
    },
    enabled: !!organizationId && !!orderId,
  });
}

export function useRecentOrders(limit: number = 10) {
  return useOrders({ limit });
}

export function usePendingOrders() {
  return useOrders({ status: 'pending' });
}

export function useCreateOrder() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      if (!organization?.id) throw new Error('No organization');

      // Generate order number
      const { data: orderNumber } = await supabase.rpc('generate_order_number', {
        _org_id: organization.id,
      });

      // Calculate totals
      const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const shippingTotal = input.shipping_total || 0;
      const total = subtotal - 0 + shippingTotal; // discount_total = 0 initially

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          organization_id: organization.id,
          order_number: orderNumber as string,
          customer_id: input.customer_id,
          lead_id: input.lead_id,
          subtotal,
          shipping_total: shippingTotal,
          total,
          shipping_address: input.shipping_address ? (input.shipping_address as unknown as Json) : null,
          billing_address: input.billing_address ? (input.billing_address as unknown as Json) : null,
          discount_code: input.discount_code,
          notes: input.notes,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = input.items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-stats'] });
      toast.success('Pedido criado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating order:', error);
      toast.error('Erro ao criar pedido');
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateOrderInput) => {
      const { data, error } = await supabase
        .from('orders')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-stats'] });
      toast.success('Pedido atualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating order:', error);
      toast.error('Erro ao atualizar pedido');
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      paymentStatus,
      fulfillmentStatus,
    }: {
      orderId: string;
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      fulfillmentStatus?: FulfillmentStatus;
    }) => {
      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (paymentStatus) updates.payment_status = paymentStatus;
      if (fulfillmentStatus) updates.fulfillment_status = fulfillmentStatus;

      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-stats'] });
      toast.success('Estado do pedido atualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating order status:', error);
      toast.error('Erro ao atualizar estado');
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-stats'] });
      toast.success('Pedido eliminado');
    },
    onError: (error: Error) => {
      console.error('Error deleting order:', error);
      toast.error('Erro ao eliminar pedido');
    },
  });
}
