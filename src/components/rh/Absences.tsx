import type { RhDecisionMode } from "@/lib/rh/schema";
import { RhAbsenceCard } from "./RhAbsenceCard";
import { AbsenceDecisionDialog } from "./AbsenceDecisionDialog";
import { AbsenceRequestDialog } from "./AbsenceRequestDialog";
import { value } from "@/lib/rh/form";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { statusLabels } from "@/lib/rh/schema";
import type { RhSnapshot, RhAbsence } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { uploadPrivate } from "@/lib/rh/api";
import { toast } from "sonner";
export function Absences({
  data,
  workspace,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RhAbsence>();
  const [periods, setPeriods] = useState<string[]>([crypto.randomUUID()]);
  const [batch, setBatch] = useState(false);
  const [filter, setFilter] = useState("all");
  const [reason, setReason] = useState("");
  const [approvedDates, setApprovedDates] = useState<string[]>([]);
  const [action, setAction] = useState<{ id: string; mode: RhDecisionMode }>();
  const canManage = data.permissions["absences.manage"];
  const canApprove = data.permissions["absences.approve"];
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const payload = {
      absence_type: value(f, "absence_type"),
      notes: value(f, "notes"),
      allocation: value(f, "allocation"),
      user_id: value(f, "user_id") || workspace.userId,
      periods: periods.map((id) => ({
        start_date: value(f, `start-${id}`),
        end_date: value(f, `end-${id}`),
        period_type: value(f, `type-${id}`),
        start_time: value(f, `from-${id}`) || null,
        end_time: value(f, `to-${id}`) || null,
      })),
      ...(editing ? { id: editing.id } : {}),
      ...(batch
        ? {
            users: f
              .getAll("users")
              .filter((x): x is string => typeof x === "string"),
          }
        : {}),
    };
    const result = await workspace.mutate.mutateAsync({
      kind: "absence",
      action: batch ? "batch" : editing ? "edit" : "create",
      payload,
    });
    const files = f
      .getAll("attachments")
      .filter((x): x is File => x instanceof File && x.size > 0);
    if (
      files.length &&
      typeof result === "object" &&
      result !== null &&
      !Array.isArray(result) &&
      typeof result.id === "string"
    ) {
      try {
        for (const file of files) {
          const target = payload.user_id;
          const path = await uploadPrivate(workspace.org, target, file);
          await workspace.mutate.mutateAsync({
            kind: "record",
            recordKind: "document",
            userId: target,
            data: {
              name: file.name,
              path,
              category: "Justificação",
              absence_id: result.id,
            },
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Pedido guardado; anexo falhou: ${error.message}`
            : "Pedido guardado; anexo falhou",
        );
        return;
      }
    }
    setOpen(false);
    setEditing(undefined);
  }
  function begin(a?: RhAbsence) {
    setEditing(a);
    setPeriods(a?.periods.map((p) => p.id) ?? [crypto.randomUUID()]);
    setBatch(false);
    setOpen(true);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => begin()}>
          <Plus className="mr-2 h-4 w-4" />
          Pedir ausência
        </Button>
        {canManage && (
          <Button
            variant="outline"
            onClick={() => {
              begin();
              setBatch(true);
            }}
          >
            Marcação em lote
          </Button>
        )}
        <select
          aria-label="Filtrar pedidos"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border bg-background p-2"
        >
          <option value="all">Todos os estados</option>
          {Object.entries(statusLabels)
            .slice(0, 5)
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      </div>
      {data.absences
        .filter((a) => filter === "all" || a.status === filter)
        .map((a) => (
          <RhAbsenceCard
            key={a.id}
            data={data}
            workspace={workspace}
            a={a}
            begin={begin}
            setAction={setAction}
            setApprovedDates={setApprovedDates}
            canManage={canManage}
            canApprove={canApprove}
          />
        ))}
      {!data.absences.length && (
        <p className="rounded-lg border p-8 text-center text-muted-foreground">
          Ainda não tem pedidos de ausência.
        </p>
      )}
      <AbsenceRequestDialog
        data={data}
        workspace={workspace}
        open={open}
        setOpen={setOpen}
        editing={editing}
        batch={batch}
        canManage={canManage}
        periods={periods}
        setPeriods={setPeriods}
        save={save}
      />
      <AbsenceDecisionDialog
        data={data}
        workspace={workspace}
        action={action}
        setAction={setAction}
        reason={reason}
        setReason={setReason}
        approvedDates={approvedDates}
        setApprovedDates={setApprovedDates}
      />
    </div>
  );
}
