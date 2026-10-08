import type { RhDecisionMode } from "@/lib/rh/schema";
import { AbsenceHistory } from "./AbsenceHistory";
import { value, memberName } from "@/lib/rh/form";
import { AbsenceAttachments } from "./AbsenceAttachments";

import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { absenceTypes, statusLabels } from "@/lib/rh/schema";
import type { RhSnapshot, RhAbsence } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";

export function RhAbsenceCard({
  data,
  workspace,
  a,
  begin,
  setAction,
  setApprovedDates,
  canManage,
  canApprove,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly a: RhAbsence;
  readonly begin: (a?: RhAbsence) => void;
  readonly setAction: (value: { id: string; mode: RhDecisionMode }) => void;
  readonly setApprovedDates: (value: string[]) => void;
  readonly canManage: boolean;
  readonly canApprove: boolean;
}) {
  return (
    <Card key={a.id}>
      <CardHeader>
        <CardTitle className="flex flex-wrap justify-between gap-2 text-base">
          <span>
            {Object.entries(absenceTypes).find(
              ([k]) => k === a.absence_type,
            )?.[1] ?? a.absence_type}{" "}
            · {memberName(data, a.user_id)}
          </span>
          <span className="text-sm text-muted-foreground">
            {statusLabels[a.status]}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {a.periods.map((p) => (
          <p key={p.id} className="flex gap-2 text-sm">
            <CalendarDays className="h-4 w-4" />
            {p.start_date} → {p.end_date}
            {p.period_type !== "full_day" &&
              ` · ${p.start_time}–${p.end_time}`}{" "}
            · {p.business_days} dias úteis · {statusLabels[p.status]}
          </p>
        ))}
        {a.notes && <p className="text-sm text-muted-foreground">{a.notes}</p>}
        <div className="flex flex-wrap gap-2">
          {!["cancelled", "rejected"].includes(a.status) &&
            canManage && (
              <>
                <Button size="sm" variant="outline" onClick={() => begin(a)}>
                  Editar / remarcar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAction({ id: a.id, mode: "cancel" })}
                >
                  Cancelar
                </Button>
              </>
            )}
          {canApprove &&
            ["pending", "partially_approved"].includes(a.status) && (
              <>
                <Button
                  size="sm"
                  onClick={() =>
                    void workspace.mutate.mutateAsync({
                      kind: "absence",
                      action: "approve",
                      payload: { id: a.id },
                    })
                  }
                >
                  {a.status === "pending" ? "Aprovar" : "Completar aprovação"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setApprovedDates([]);
                    setAction({ id: a.id, mode: "partial" });
                  }}
                >
                  Aprovar dias selecionados
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive text-foreground"
                  onClick={() => setAction({ id: a.id, mode: "reject" })}
                >
                  Rejeitar
                </Button>
              </>
            )}
          {canApprove &&
            ["approved", "partially_approved"].includes(a.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAction({ id: a.id, mode: "withdraw" })}
              >
                Retirar aprovação
              </Button>
            )}
        </div>
        <AbsenceAttachments data={data} id={a.id} />
        <AbsenceHistory data={data} id={a.id} />
      </CardContent>
    </Card>
  );
}
