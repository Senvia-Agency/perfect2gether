import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { toast } from "sonner";

interface IssueInvoiceReceiptParams {
  saleId: string;
  organizationId: string;
  observations?: string;
}

export function useIssueInvoiceReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, organizationId, observations }: IssueInvoiceReceiptParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");

      return await invokeFunction<{ invoice_reference: string }>("issue-invoice-receipt", {
        sale_id: saleId,
        organization_id: organizationId,
        observations: observations || undefined,
      });
    },
    onSuccess: (data) => {
      toast.success(`Fatura-Recibo emitida: ${data.invoice_reference}`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale-payments"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao emitir fatura-recibo");
    },
  });
}
