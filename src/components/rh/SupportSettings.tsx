import { value } from "@/lib/rh/form";
import { ConfigRecords } from "./ConfigRecords";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { Field, Submit } from "./Fields";
import { text } from "@/lib/rh/schema";
import type { RhSnapshot } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";

import type { RhRecord } from "@/lib/rh/schema";
export function SupportSettings({
  data,
  workspace,
  departments,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly departments: readonly RhRecord[];
}) {
  return (
    <Card className="rh-card">
      <CardHeader>
        <CardTitle>Configurar suporte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ConfigRecords
          records={data.records.filter((r) =>
            ["department", "subject"].includes(r.kind),
          )}
          data={data}
          workspace={workspace}
        />
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void workspace.mutate.mutateAsync({
              kind: "record",
              recordKind: "department",
              data: { name: value(f, "department-name") },
            });
          }}
        >
          <Field name="department-name" label="Nome do departamento" required />
          <Submit
            busy={workspace.mutate.isPending}
            label="Adicionar departamento"
          />
        </form>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void workspace.mutate.mutateAsync({
              kind: "record",
              recordKind: "subject",
              data: {
                name: value(f, "subject-name"),
                department_id: value(f, "subject-department"),
              },
            });
          }}
        >
          <Field name="subject-name" label="Nome do assunto" required />
          <Field name="subject-department" label="Departamento">
            <select
              id="subject-department"
              name="subject-department"
              className="w-full rounded-md border bg-background p-2"
              required
            >
              {departments.map((r) => (
                <option key={r.id} value={r.id}>
                  {text(r.data, "name")}
                </option>
              ))}
            </select>
          </Field>
          <Submit busy={workspace.mutate.isPending} label="Adicionar assunto" />
        </form>
      </CardContent>
    </Card>
  );
}
