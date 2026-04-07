import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { addDays, addMonths } from "date-fns";
import type { RecurringStatus } from "@/types/sales";

interface RecurringSaleWithClient {
  id: string;
  code: string;
  client_id: string | null;
  recurring_value: number;
  recurring_status: RecurringStatus;
  next_renewal_date: string;
  last_renewal_date: string | null;
  organization_id: string;
  client?: {
    id: string;
    name: string;
  } | null;
}

export function useRecurringSales() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ["recurring-sales", organization?.id],
    queryFn: async (): Promise<RecurringSaleWithClient[]> => {
      if (!organization?.id) return [];

      const soon = addDays(new Date(), 7).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          code,
          client_id,
          recurring_value,
          recurring_status,
          next_renewal_date,
          last_renewal_date,
          organization_id,
          client:crm_clients(id, name)
        `)
        .eq("organization_id", organization.id)
        .eq("has_recurring", true)
        .eq("recurring_status", "active")
        .lte("next_renewal_date", soon)
        .order("next_renewal_date", { ascending: true });

      if (error) throw error;
      return (data as unknown as RecurringSaleWithClient[]) || [];
    },
    enabled: !!organization?.id,
  });
}

export function useRenewSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      saleId, 
      organizationId,
      amount,
      paymentMethod
    }: { 
      saleId: string;
      organizationId: string;
      amount: number;
      paymentMethod?: string;
    }) => {
      // Criar pagamento
      const { error: paymentError } = await supabase
        .from("sale_payments")
        .insert({
          organization_id: organizationId,
          sale_id: saleId,
          amount,
          payment_date: new Date().toISOString().split('T')[0],
          status: 'pending',
          payment_method: paymentMethod || null,
          notes: 'Renovação mensal',
        });

      if (paymentError) throw paymentError;

      // Atualizar venda com próxima renovação
      const nextMonth = addMonths(new Date(), 1).toISOString().split('T')[0];
      const { error: saleError } = await supabase
        .from("sales")
        .update({
          last_renewal_date: new Date().toISOString().split('T')[0],
          next_renewal_date: nextMonth,
        })
        .eq("id", saleId);

      if (saleError) throw saleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale-payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Renovação registada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao registar renovação");
    },
  });
}

export function useCancelRecurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .from("sales")
        .update({
          recurring_status: 'cancelled',
        })
        .eq("id", saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-sales"] });
      toast.success("Recorrência cancelada");
    },
    onError: () => {
      toast.error("Erro ao cancelar recorrência");
    },
  });
}
