import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendInvoiceEmailParams {
  documentId: number;
  documentType: "invoice" | "invoice_receipt" | "receipt" | "credit_note";
  organizationId: string;
  email: string;
  subject: string;
  body: string;
}

export function useSendInvoiceEmail() {
  return useMutation({
    mutationFn: async (params: SendInvoiceEmailParams) => {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: {
          document_id: params.documentId,
          document_type: params.documentType,
          organization_id: params.organizationId,
          email: params.email,
          subject: params.subject,
          body: params.body,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Email enviado com sucesso");
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar email", { description: error.message });
    },
  });
}
