import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IssueInvoiceParams {
  saleId: string;
  organizationId: string;
  observations?: string;
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, organizationId, observations }: IssueInvoiceParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");

      const res = await supabase.functions.invoke("issue-invoice", {
        body: { 
          sale_id: saleId, 
          organization_id: organizationId,
          observations: observations || undefined,
        },
      });

      if (res.error) {
        throw new Error(res.error.message || "Erro ao emitir fatura");
      }

      const data = res.data;
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Fatura emitida: ${data.invoice_reference}`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao emitir fatura");
    },
  });
}
