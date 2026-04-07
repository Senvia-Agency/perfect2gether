import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CancelInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
  invoiceReference: string;
}

export function CancelInvoiceDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  invoiceReference,
}: CancelInvoiceDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) setReason("");
    onOpenChange(value);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anular Fatura</AlertDialogTitle>
          <AlertDialogDescription>
            Tem a certeza que deseja anular a fatura <strong>{invoiceReference}</strong>?
            Esta ação será refletida no sistema de faturação e não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="cancel-reason">Motivo de anulação *</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Indique o motivo da anulação..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? "A anular..." : "Anular Fatura"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
