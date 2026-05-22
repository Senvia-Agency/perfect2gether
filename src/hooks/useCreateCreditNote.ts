import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { toast } from "sonner";

interface CreateCreditNoteParams {
  organizationId: string;
  saleId?: string;
  paymentId?: string;
  originalDocumentId: number;
  originalDocumentType: "invoice" | "invoice_receipt" | "receipt" | "credit_note";
  reason: string;
  items?: Array<{
    name: string;
    description?: string;
    unit_price: number;
    quantity: number;
    tax?: { name: string; value: number };
  }>;
}

export function useCreateCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateCreditNoteParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");

      return await invokeFunction("create-credit-note", {
        organization_id: params.organizationId,
        sale_id: params.saleId || null,
        payment_id: params.paymentId || null,
        original_document_id: params.originalDocumentId,
        original_document_type: params.originalDocumentType,
        reason: params.reason,
        items: params.items || null,
      });
    },
    onSuccess: (data) => {
      toast.success(`Nota de crédito emitida: ${data.credit_note_reference}`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale-payments"] });
      queryClient.invalidateQueries({ queryKey: ["all-payments"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar nota de crédito");
    },
  });
}