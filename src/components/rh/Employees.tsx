import { EmployeeDocuments } from "./EmployeeDocuments";
import { EmployeeHealth } from "./EmployeeHealth";
import { value, memberName } from "@/lib/rh/form";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { RhSnapshot, RhRecord } from "@/lib/rh/schema";
import { text } from "@/lib/rh/schema";
import { uploadPrivate, privateUrl } from "@/lib/rh/api";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { Field, Submit } from "./Fields";
import { toast } from "sonner";
export function Employees({
  data,
  workspace,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
}) {
  const [selected, setSelected] = useState(workspace.userId);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const manager = data.permissions["employees.manage"];
  const employee = data.records.find(
    (r) => r.kind === "employee" && r.user_id === selected,
  );
  const details = employee?.data ?? {};
  const documents = data.records.filter(
    (r) => r.kind === "document" && r.user_id === selected,
  );
  const health = data.records.filter(
    (r) => r.kind === "health" && r.user_id === selected,
  );
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const keys = manager
      ? [
          "full_name",
          "phone",
          "address",
          "nationality",
          "identity_document",
          "emergency_contact",
          "birth_date",
          "admission_date",
          "job_title",
          "department",
        ]
      : [
          "phone",
          "address",
          "nationality",
          "identity_document",
          "emergency_contact",
        ];
    const fields = Object.fromEntries(keys.map((k) => [k, value(f, k)]));
    await workspace.mutate.mutateAsync({
      kind: "record",
      recordKind: "employee",
      userId: selected,
      ...(employee ? { id: employee.id } : {}),
      data: fields,
    });
    setEditing(false);
  }
  async function files(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      for (const file of f
        .getAll("files")
        .filter((x): x is File => x instanceof File && x.size > 0)) {
        const path = await uploadPrivate(workspace.org, selected, file);
        await workspace.mutate.mutateAsync({
          kind: "record",
          recordKind: "document",
          userId: selected,
          data: { name: file.name, path, category: value(f, "category") },
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar documentos",
      );
    } finally {
      setBusy(false);
    }
  }
  async function download(r: RhRecord) {
    try {
      window.open(
        await privateUrl(text(r.data, "path")),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao abrir documento",
      );
    }
  }
  return (
    <div className="space-y-6">
      <Field label="Selecionar colaborador" name="employee-select">
        <select
          id="employee-select"
          className="w-full rounded-md border bg-background p-2"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {data.members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name || m.email || m.user_id}
            </option>
          ))}
        </select>
      </Field>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            {memberName(data, selected)}
            {(selected === workspace.userId || manager) && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Editar ficha
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["phone", "Telefone"],
              ["address", "Morada"],
              ["nationality", "Nacionalidade"],
              ["identity_document", "Documento de identificação"],
              ["emergency_contact", "Contacto de emergência"],
              ["birth_date", "Nascimento"],
              ["admission_date", "Admissão"],
              ["job_title", "Cargo"],
              ["department", "Departamento"],
            ].map(([k, label]) => (
              <div key={k}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd>{text(details, k) || "Não preenchido"}</dd>
              </div>
            ))}
          </dl>
          {manager && (
            <p className="mt-4 text-sm">
              <a className="text-primary underline" href="/settings">
                Gerir acessos, email e password nas Definições da equipa
              </a>
            </p>
          )}
        </CardContent>
      </Card>
      <EmployeeDocuments
        data={data}
        workspace={workspace}
        documents={documents}
        selected={selected}
        busy={busy}
        files={files}
        download={download}
      />
      <EmployeeHealth
        data={data}
        workspace={workspace}
        health={health}
        manager={manager}
        selected={selected}
      />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ficha do colaborador</DialogTitle>
            <DialogDescription>
              Atualize os dados autorizados da ficha do colaborador.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => void save(e)}
            className="grid gap-3 sm:grid-cols-2"
          >
            {[
              ["phone", "Telefone", "tel"],
              ["address", "Morada", "text"],
              ["nationality", "Nacionalidade", "text"],
              ["identity_document", "Documento identificação", "text"],
              ["emergency_contact", "Contacto emergência", "text"],
              ...(manager
                ? [
                    ["full_name", "Nome completo", "text"],
                    ["birth_date", "Nascimento", "date"],
                    ["admission_date", "Admissão", "date"],
                    ["job_title", "Cargo", "text"],
                    ["department", "Departamento", "text"],
                  ]
                : []),
            ].map(([k, label, type]) => (
              <Field
                key={k}
                name={k}
                label={label}
                type={type}
                value={text(details, k)}
              />
            ))}
            <Submit busy={workspace.mutate.isPending} />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
