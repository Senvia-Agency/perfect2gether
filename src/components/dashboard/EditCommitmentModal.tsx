import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useCommitments, CommitmentTotals } from "@/hooks/useCommitments";
import { useAuth } from "@/contexts/AuthContext";
import { useModules } from "@/hooks/useModules";

interface EditCommitmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: CommitmentTotals | null;
}

export function EditCommitmentModal({ open, onOpenChange, existing }: EditCommitmentModalProps) {
  const { user, organization } = useAuth();
  const { saveCommitment } = useCommitments(user?.id);
  const { modules } = useModules();
  const showEnergy = organization?.niche === 'telecom' && modules.energy;

  const [totals, setTotals] = useState<CommitmentTotals>({
    total_nifs: 0,
    total_energia_mwh: 0,
    total_solar_kwp: 0,
    total_comissao: 0,
  });

  useEffect(() => {
    if (open) {
      setTotals(existing || { total_nifs: 0, total_energia_mwh: 0, total_solar_kwp: 0, total_comissao: 0 });
    }
  }, [open, existing]);

  const handleSave = () => {
    saveCommitment.mutate(totals, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-0 gap-0">
        <DialogHeader className="p-4 md:p-6 pb-2">
          <DialogTitle>Definir Compromisso Mensal</DialogTitle>
        </DialogHeader>

        <div className="px-4 md:px-6 pb-4 space-y-4">
          <div>
            <Label className="text-xs">Nº de NIFs</Label>
            <Input
              type="number"
              value={totals.total_nifs || ""}
              onChange={(e) => setTotals({ ...totals, total_nifs: Number(e.target.value) || 0 })}
              placeholder="Ex: 5"
              className="h-9 text-sm"
            />
          </div>
          {showEnergy && (
            <>
              <div>
                <Label className="text-xs">Total Energia (MWh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={totals.total_energia_mwh || ""}
                  onChange={(e) => setTotals({ ...totals, total_energia_mwh: Number(e.target.value) || 0 })}
                  placeholder="Ex: 12.5"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Total Solar (kWp)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={totals.total_solar_kwp || ""}
                  onChange={(e) => setTotals({ ...totals, total_solar_kwp: Number(e.target.value) || 0 })}
                  placeholder="Ex: 8.0"
                  className="h-9 text-sm"
                />
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">Total Comissão (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={totals.total_comissao || ""}
              onChange={(e) => setTotals({ ...totals, total_comissao: Number(e.target.value) || 0 })}
              placeholder="Ex: 1200"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="p-4 md:p-6 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveCommitment.isPending}>
            {saveCommitment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
