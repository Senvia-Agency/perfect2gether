import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { toast } from "sonner";

interface GenerateReceiptParams {
  saleId: string;
  paymentId: string;
  organizationId: string;
}

export function useGenerateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, paymentId, organizationId }: GenerateReceiptParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");

      return await invokeFunction<{ invoice_reference: string }>("generate-receipt", {
        sale_id: saleId,
        payment_id: paymentId,
        organization_id: organizationId,
      });
    },
    onSuccess: (data) => {
      toast.success(`Recibo gerado: ${data.invoice_reference}`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale-payments"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao gerar recibo");
    },
  });
}
