import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { SalePayment, PaymentMethod, PaymentRecordStatus } from "@/types/sales";

export function useSalePayments(saleId: string | undefined) {
  return useQuery({
    queryKey: ["sale-payments", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_payments")
        .select("*")
        .eq("sale_id", saleId)
        .order("payment_date", { ascending: true });

      if (error) throw error;
      return data as SalePayment[];
    },
    enabled: !!saleId,
  });
}

interface CreatePaymentData {
  sale_id: string;
  organization_id: string;
  amount: number;
  payment_date: string;
  payment_method?: PaymentMethod | null;
  invoice_reference?: string | null;
  invoice_file_url?: string | null;
  status: PaymentRecordStatus;
  notes?: string | null;
}

export function useCreateSalePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentData) => {
      const { data: result, error } = await supabase
        .from("sale_payments")
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sale-payments", variables.sale_id] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Pagamento adicionado com sucesso");
    },
    onError: (error) => {
      console.error("Error creating payment:", error);
      toast.error("Erro ao adicionar pagamento");
    },
  });
}

interface UpdatePaymentData {
  paymentId: string;
  saleId: string;
  updates: {
    amount?: number;
    payment_date?: string;
    payment_method?: PaymentMethod | null;
    invoice_reference?: string | null;
    invoice_file_url?: string | null;
    status?: PaymentRecordStatus;
    notes?: string | null;
  };
}

export function useUpdateSalePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, updates }: UpdatePaymentData) => {
      const { error } = await supabase
        .from("sale_payments")
        .update(updates)
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sale-payments", variables.saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Pagamento atualizado com sucesso");
    },
    onError: (error) => {
      console.error("Error updating payment:", error);
      toast.error("Erro ao atualizar pagamento");
    },
  });
}

interface DeletePaymentData {
  paymentId: string;
  saleId: string;
}

export function useDeleteSalePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId }: DeletePaymentData) => {
      const { error } = await supabase
        .from("sale_payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sale-payments", variables.saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Pagamento eliminado com sucesso");
    },
    onError: (error) => {
      console.error("Error deleting payment:", error);
      toast.error("Erro ao eliminar pagamento");
    },
  });
}

// Helper to calculate payment summary
export function calculatePaymentSummary(payments: SalePayment[], saleTotal: number) {
  const totalPaid = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  
  const totalScheduled = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const remaining = Math.max(0, saleTotal - totalPaid);
  const remainingToSchedule = Math.max(0, saleTotal - totalPaid - totalScheduled);
  const percentage = saleTotal > 0 ? (totalPaid / saleTotal) * 100 : 0;

  // Calculate payment status based on payments
  const paymentStatus: 'pending' | 'partial' | 'paid' = 
    totalPaid === 0 ? 'pending' :
    totalPaid >= saleTotal ? 'paid' :
    'partial';

  return {
    totalPaid,
    totalScheduled,
    remaining,
    remainingToSchedule,
    percentage: Math.min(100, percentage),
    paymentStatus,
  };
}
