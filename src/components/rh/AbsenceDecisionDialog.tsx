import type { RhDecisionMode } from "@/lib/rh/schema";
import { TeamOverlapWarning } from "./TeamOverlapWarning";
import { value } from "@/lib/rh/form";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, Submit } from "./Fields";

import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";

import { toast } from "sonner";

export function AbsenceDecisionDialog({
  data,
  workspace,
  action,
  setAction,
  reason,
  setReason,
  approvedDates,
  setApprovedDates,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly action: { id: string; mode: RhDecisionMode } | undefined;
  readonly setAction: (
    value: { id: string; mode: RhDecisionMode } | undefined,
  ) => void;
  readonly reason: string;
  readonly setReason: (value: string) => void;
  readonly approvedDates: string[];
  readonly setApprovedDates: (value: string[]) => void;
}) {
  return (
    <Dialog
      open={!!action}
      onOpenChange={() => {
        setAction(undefined);
        setReason("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action?.mode === "partial"
              ? "Aprovar parcialmente"
              : action?.mode === "reject"
                ? "Rejeitar"
                : action?.mode === "withdraw"
                  ? "Retirar aprovação"
                  : "Cancelar pedido"}
          </DialogTitle>
          <DialogDescription>
            Confirme os períodos e os dados do pedido. As alterações ficam
            registadas no histórico.
          </DialogDescription>
        </DialogHeader>
        <TeamOverlapWarning
          data={data}
          userId={
            data.absences.find((a) => a.id === action?.id)?.user_id ??
            workspace.userId
          }
          periods={
            data.absences.find((a) => a.id === action?.id)?.periods ?? []
          }
        />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (action?.mode === "partial" && !approvedDates.length) {
              toast.error("Selecione pelo menos um dia para aprovar");
              return;
            }
            if (action)
              void workspace.mutate
                .mutateAsync({
                  kind: "absence",
                  action: action.mode,
                  payload: {
                    id: action.id,
                    reason,
                    approved_dates: approvedDates,
                  },
                })
                .then(() => {
                  setAction(undefined);
                  setReason("");
                });
          }}
        >
          {action?.mode === "partial" && (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {data.absences
                .find((a) => a.id === action.id)
                ?.periods.flatMap((p) => {
                  const out: string[] = [];
                  for (
                    let d = new Date(p.start_date + "T12:00:00");
                    d <= new Date(p.end_date + "T12:00:00");
                    d.setDate(d.getDate() + 1)
                  ) {
                    const date = d.toISOString().slice(0, 10);
                    if (
                      d.getDay() !== 0 &&
                      d.getDay() !== 6 &&
                      !data.holidays.some((h) => h.date === date)
                    )
                      out.push(date);
                  }
                  return out;
                })
                .map((date) => (
                  <label key={date} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={approvedDates.includes(date)}
                      onChange={(e) =>
                        setApprovedDates(
                          e.target.checked
                            ? [...approvedDates, date]
                            : approvedDates.filter((x) => x !== date),
                        )
                      }
                    />
                    {date}
                  </label>
                ))}
              <p className="text-sm text-muted-foreground">
                Os restantes dias serão rejeitados.
              </p>
            </div>
          )}
          <Field name="reason" label="Motivo">
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={
                action?.mode === "reject" || action?.mode === "withdraw"
              }
            />
          </Field>
          <Submit busy={workspace.mutate.isPending} label="Confirmar" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
