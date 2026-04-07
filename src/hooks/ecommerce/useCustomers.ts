import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Customer, CustomerAddress, CreateCustomerInput, UpdateCustomerInput, AddressType } from '@/types/ecommerce';

export function useCustomers() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['customers', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!organizationId,
  });
}

export function useCustomer(customerId: string | undefined) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['customers', organizationId, customerId],
    queryFn: async () => {
      if (!organizationId || !customerId) return null;

      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          addresses:customer_addresses(*)
        `)
        .eq('id', customerId)
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;
      return data as Customer;
    },
    enabled: !!organizationId && !!customerId,
  });
}

export function useCustomerByEmail(email: string | undefined) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['customers', organizationId, 'email', email],
    queryFn: async () => {
      if (!organizationId || !email) return null;

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!organizationId && !!email,
  });
}

export function useCreateCustomer() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      if (!organization?.id) throw new Error('No organization');

      const { data, error } = await supabase
        .from('customers')
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
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente criado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating customer:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um cliente com este email');
      } else {
        toast.error('Erro ao criar cliente');
      }
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCustomerInput) => {
      const { data, error } = await supabase
        .from('customers')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente atualizado');
    },
    onError: (error: Error) => {
      console.error('Error updating customer:', error);
      toast.error('Erro ao atualizar cliente');
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente eliminado');
    },
    onError: (error: Error) => {
      console.error('Error deleting customer:', error);
      toast.error('Erro ao eliminar cliente');
    },
  });
}

// Customer Addresses
export function useCustomerAddresses(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data as CustomerAddress[];
    },
    enabled: !!customerId,
  });
}

export function useCreateCustomerAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      type = 'shipping',
      isDefault = false,
      name,
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country = 'PT',
      phone,
    }: {
      customerId: string;
      type?: AddressType;
      isDefault?: boolean;
      name: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      postalCode: string;
      country?: string;
      phone?: string;
    }) => {
      // If this is default, unset other defaults of same type
      if (isDefault) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', customerId)
          .eq('type', type);
      }

      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({
          customer_id: customerId,
          type,
          is_default: isDefault,
          name,
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          postal_code: postalCode,
          country,
          phone,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses', variables.customerId] });
      toast.success('Morada adicionada');
    },
    onError: (error: Error) => {
      console.error('Error creating address:', error);
      toast.error('Erro ao adicionar morada');
    },
  });
}

export function useDeleteCustomerAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ addressId, customerId }: { addressId: string; customerId: string }) => {
      const { error } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;
      return customerId;
    },
    onSuccess: (customerId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses', customerId] });
      toast.success('Morada eliminada');
    },
    onError: (error: Error) => {
      console.error('Error deleting address:', error);
      toast.error('Erro ao eliminar morada');
    },
  });
}
