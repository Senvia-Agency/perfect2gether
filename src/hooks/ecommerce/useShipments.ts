import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Shipment, CreateShipmentInput, UpdateShipmentInput, ShipmentStatus } from '@/types/ecommerce';

export function useShipments(options?: {
  orderId?: string;
  status?: ShipmentStatus;
  limit?: number;
}) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['shipments', organizationId, options],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('shipments')
        .select(`
          *,
          order:orders(id, order_number, customer:customers(name, email))
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (options?.orderId) {
        query = query.eq('order_id', options.orderId);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Shipment[];
    },
    enabled: !!organizationId,
  });
}

export function useShipment(shipmentId: string | undefined) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['shipments', organizationId, shipmentId],
    queryFn: async () => {
      if (!organizationId || !shipmentId) return null;

      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          order:orders(*, customer:customers(*))
        `)
        .eq('id', shipmentId)
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;
      return data as unknown as Shipment;
    },
    enabled: !!organizationId && !!shipmentId,
  });
}

export function usePendingShipments() {
  return useShipments({ status: 'pending' });
}

export function useCreateShipment() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShipmentInput) => {
      if (!organization?.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('shipments')
        .insert({
          ...input,
          organization_id: organization.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update order fulfillment status
      await supabase
        .from('orders')
        .update({ fulfillment_status: 'partial' })
        .eq('id', input.order_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Envio criado');
    },
    onError: (error: Error) => {
      console.error('Error creating shipment:', error);
      toast.error('Erro ao criar envio');
    },
  });
}

export function useUpdateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateShipmentInput) => {
      const updates: Record<string, unknown> = { ...input };

      // Auto-set timestamps based on status
      if (input.status === 'in_transit' && !input.shipped_at) {
        updates.shipped_at = new Date().toISOString();
      }
      if (input.status === 'delivered' && !input.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('shipments')
        .update(updates)
        .eq('id', id)
        .select('*, order_id')
        .single();

      if (error) throw error;

      // If delivered, update order fulfillment status
      if (input.status === 'delivered') {
        await supabase
          .from('orders')
          .update({ 
            fulfillment_status: 'fulfilled',
            status: 'delivered',
          })
          .eq('id', data.order_id);
      }

      // If in transit, update order status
      if (input.status === 'in_transit') {
        await supabase
          .from('orders')
          .update({ status: 'shipped' })
          .eq('id', data.order_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Envio atualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating shipment:', error);
      toast.error('Erro ao atualizar envio');
    },
  });
}

export function useMarkShipped() {
  const updateShipment = useUpdateShipment();

  return useMutation({
    mutationFn: async ({
      shipmentId,
      carrier,
      trackingNumber,
      trackingUrl,
    }: {
      shipmentId: string;
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    }) => {
      return updateShipment.mutateAsync({
        id: shipmentId,
        status: 'in_transit',
        carrier,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        shipped_at: new Date().toISOString(),
      });
    },
  });
}

export function useMarkDelivered() {
  const updateShipment = useUpdateShipment();

  return useMutation({
    mutationFn: async (shipmentId: string) => {
      return updateShipment.mutateAsync({
        id: shipmentId,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      });
    },
  });
}

export function useDeleteShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('id', shipmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast.success('Envio eliminado');
    },
    onError: (error: Error) => {
      console.error('Error deleting shipment:', error);
      toast.error('Erro ao eliminar envio');
    },
  });
}
