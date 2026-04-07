import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { absenceTypeLabels, type DatePeriod, type RhHoliday } from "@/lib/rh-utils";
import { useCreateAbsence, useMyVacationBalance, useTeamOverlappingAbsences } from "@/hooks/useRhAbsences";
import { useAuth } from "@/contexts/AuthContext";
import RhMultiPeriodSelector from "./RhMultiPeriodSelector";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holidays: RhHoliday[];
}

export default function RhAbsenceRequestForm({ open, onOpenChange, holidays }: Props) {
  const [absenceType, setAbsenceType] = useState("");
  const [periods, setPeriods] = useState<DatePeriod[]>([]);
  const [notes, setNotes] = useState("");

  const { user, organization } = useAuth();
  const createAbsence = useCreateAbsence();
  const { data: balance } = useMyVacationBalance();
  const { data: overlaps = [] } = useTeamOverlappingAbsences(user?.id, periods, organization?.id);

  const maxVacationDays = balance ? balance.total_days - balance.used_days : undefined;

  const handleSubmit = async () => {
    if (!absenceType || periods.length === 0) return;

    await createAbsence.mutateAsync({
      absenceType,
      periods,
      notes,
      holidays,
    });

    setAbsenceType("");
    setPeriods([]);
    setNotes("");
    onOpenChange(false);
  };

  const reset = () => {
    setAbsenceType("");
    setPeriods([]);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Marcar Ausência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium mb-1.5">Tipo de Ausência *</label>
            <Select value={absenceType} onValueChange={setAbsenceType}>
              <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
              <SelectContent>
                {Object.entries(absenceTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RhMultiPeriodSelector
            periods={periods}
            onPeriodsChange={setPeriods}
            holidays={holidays}
            maxDays={absenceType === "vacation" ? maxVacationDays : undefined}
            absenceType={absenceType}
          />

          {/* Team overlap warnings */}
          {overlaps.length > 0 && (
            <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-300">
                <p className="font-medium text-sm mb-1">Colegas de equipa com ausências sobrepostas:</p>
                <ul className="space-y-0.5 text-xs">
                  {overlaps.map((o, i) => (
                    <li key={i}>
                      <span className="font-semibold">{o.userName}</span>
                      {" — "}
                      {absenceTypeLabels[o.absenceType] || o.absenceType}
                      {" ("}
                      {o.status === "approved" ? "aprovado" : "pendente"}
                      {") "}
                      {o.periods.map((p, j) => (
                        <span key={j}>
                          {format(new Date(p.startDate), "dd MMM", { locale: pt })}
                          {p.startDate !== p.endDate && ` - ${format(new Date(p.endDate), "dd MMM", { locale: pt })}`}
                          {j < o.periods.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Notas</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!absenceType || periods.length === 0 || createAbsence.isPending}
            className="w-full"
          >
            {createAbsence.isPending ? "A submeter..." : "Submeter Pedido"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
