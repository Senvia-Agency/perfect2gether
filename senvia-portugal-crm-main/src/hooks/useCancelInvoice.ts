import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CancelInvoiceParams {
  paymentId?: string;
  saleId?: string;
  organizationId: string;
  reason: string;
  invoicexpressId: number;
  documentType: "invoice" | "invoice_receipt" | "receipt" | "credit_note";
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, saleId, organizationId, reason, invoicexpressId, documentType }: CancelInvoiceParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("cancel-invoice", {
        body: {
          payment_id: paymentId || null,
          sale_id: saleId || null,
          organization_id: organizationId,
          reason,
          invoicexpress_id: invoicexpressId,
          document_type: documentType,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Documento anulado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["sale-payments"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao anular: ${error.message}`);
    },
  });
}
