import { useState, useEffect } from "react";
import { Mail, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSendInvoiceEmail } from "@/hooks/useSendInvoiceEmail";

interface SendInvoiceEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: number;
  documentType: "invoice" | "invoice_receipt" | "receipt" | "credit_note";
  organizationId: string;
  reference: string;
  clientEmail?: string | null;
}

export function SendInvoiceEmailModal({
  open,
  onOpenChange,
  documentId,
  documentType,
  organizationId,
  reference,
  clientEmail,
}: SendInvoiceEmailModalProps) {
  const docLabel = documentType === "receipt" ? "Recibo" : "Fatura";

  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sendEmail = useSendInvoiceEmail();

  useEffect(() => {
    if (open) {
      setEmail(clientEmail || "");
      setSubject(`${docLabel} ${reference}`);
      setBody(
        `Exmo(a). Cliente,\n\nSegue em anexo o documento ${docLabel} ${reference}.\n\nCom os melhores cumprimentos.`
      );
    }
  }, [open, clientEmail, reference, docLabel]);

  const handleSubmit = () => {
    if (!email) return;
    sendEmail.mutate(
      { documentId, documentType, organizationId, email, subject, body },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Enviar {docLabel} por Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email do destinatário</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Corpo do email</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!email || sendEmail.isPending}>
            {sendEmail.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-1" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
