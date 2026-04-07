import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { useApproveAbsence, useRejectAbsence, type RhAbsence } from "@/hooks/useRhAbsences";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absence: RhAbsence | null;
  mode: "approve" | "reject";
}

export default function RhAbsenceApprovalDialog({ open, onOpenChange, absence, mode }: Props) {
  const [reason, setReason] = useState("");
  const approveAbsence = useApproveAbsence();
  const rejectAbsence = useRejectAbsence();

  if (!absence) return null;

  const totalDays = (absence.rh_absence_periods || []).reduce((s, p) => s + Number(p.business_days), 0);

  const handleConfirm = async () => {
    if (mode === "approve") {
      await approveAbsence.mutateAsync({ absenceId: absence.id, mode: "approve" });
    } else {
      await rejectAbsence.mutateAsync({ absenceId: absence.id, reason: reason.trim() });
    }
    setReason("");
    onOpenChange(false);
  };

  const isLoading = approveAbsence.isPending || rejectAbsence.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "approve" ? "Aprovar Pedido" : "Rejeitar Pedido"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "approve" ? (
            <div className="bg-primary/10 rounded-lg p-4 flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Confirmar aprovação</p>
                <p className="text-sm text-muted-foreground">
                  Serão aprovados todos os {totalDays} dias úteis solicitados por {absence.user_name}.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-destructive/10 rounded-lg p-4 flex items-start gap-3">
                <X className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Rejeitar pedido</p>
                  <p className="text-sm text-muted-foreground">
                    O pedido de {totalDays} dias úteis de {absence.user_name} será rejeitado.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Motivo (opcional)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo da rejeição..." rows={3} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
          <Button
            variant={mode === "approve" ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "A processar..." : mode === "approve" ? "Aprovar" : "Rejeitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
