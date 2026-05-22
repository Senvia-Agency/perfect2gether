import { useMutation } from "@tanstack/react-query";
import { invokeFunction } from "@/lib/invokeFunction";
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
      return await invokeFunction("send-invoice-email", {
        document_id: params.documentId,
        document_type: params.documentType,
        organization_id: params.organizationId,
        email: params.email,
        subject: params.subject,
        body: params.body,
      });
    },
    onSuccess: () => {
      toast.success("Email enviado com sucesso");
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar email", { description: error.message });
    },
  });
}
