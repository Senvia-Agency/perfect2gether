import { value } from "@/lib/rh/form";
import { ConfigRecords } from "./ConfigRecords";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { RhSnapshot, RhRecord } from "@/lib/rh/schema";
import { text } from "@/lib/rh/schema";

import { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { Field, Submit } from "./Fields";

export function EmployeeHealth({
  data,
  workspace,
  health,
  manager,
  selected,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly health: readonly RhRecord[];
  readonly manager: boolean;
  readonly selected: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saúde no trabalho</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {manager && (
          <ConfigRecords records={health} data={data} workspace={workspace} />
        )}
        {health.map((r) => (
          <div key={r.id} className="rounded-md border p-3">
            <p>
              {text(r.data, "title") || "Consulta de saúde no trabalho"} ·{" "}
              {new Date(text(r.data, "appointment_at")).toLocaleString("pt-PT")}
            </p>
            <p className="text-sm text-muted-foreground">
              Lembrete:{" "}
              {new Date(text(r.data, "remind_at")).toLocaleString("pt-PT")}
            </p>
            <p className="text-sm">{text(r.data, "notes")}</p>
            <p className="text-sm text-muted-foreground">
              Próxima consulta:{" "}
              {text(r.data, "next_at")
                ? new Date(text(r.data, "next_at")).toLocaleDateString("pt-PT")
                : "A confirmar"}{" "}
              · renovação: {String(r.data.renewal_months ?? 12)} meses
            </p>
          </div>
        ))}
        {manager && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void workspace.mutate.mutateAsync({
                kind: "record",
                recordKind: "health",
                userId: selected,
                data: {
                  title: value(f, "health-title"),
                  appointment_at: new Date(
                    value(f, "appointment"),
                  ).toISOString(),
                  remind_at: new Date(value(f, "remind")).toISOString(),
                  notes: value(f, "health-notes"),
                  renewal_months: Number(value(f, "renewal-months")),
                },
              });
            }}
          >
            <Field label="Consulta" name="health-title" required />
            <Field
              label="Data / hora"
              name="appointment"
              type="datetime-local"
              required
            />
            <Field
              label="Lembrete"
              name="remind"
              type="datetime-local"
              required
            />
            <Field label="Observações" name="health-notes" />
            <Field
              label="Renovação (meses)"
              name="renewal-months"
              type="number"
              value={12}
              required
            />
            <Submit
              busy={workspace.mutate.isPending}
              label="Agendar consulta e lembrete"
            />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
