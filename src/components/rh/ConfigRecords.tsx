import { toast } from "sonner";
import { RecordField } from "./RecordField";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Submit } from "./Fields";
import { value } from "@/lib/rh/form";
import { text } from "@/lib/rh/schema";
import type { RhRecord, RhSnapshot } from "@/lib/rh/schema";
import type { Json } from "@/integrations/supabase/types";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";
const labels: Readonly<Record<string, string>> = {
  renewal_months: "Renovação (meses)",
  category: "Categoria",
  name: "Nome",
  title: "Título",
  body: "Texto",
  event: "Evento",
  department_id: "Departamento",
  channel: "Canal",
  emails: "Emails (separados por vírgula)",
  recipients: "Destinatários",
  active: "Estado",
  appointment_at: "Data da consulta",
  remind_at: "Data do lembrete",
  notes: "Observações",
};
const kinds: Readonly<Record<string, string>> = {
  notice: "aviso",
  group: "grupo",
  recipient: "destinatários",
  department: "departamento",
  subject: "assunto",
  document: "documento",
  health: "consulta",
};

export function ConfigRecords({
  records,
  data,
  workspace,
}: {
  readonly records: readonly RhRecord[];
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
}) {
  const [edit, setEdit] = useState<RhRecord>();
  const [remove, setRemove] = useState<RhRecord>();
  const fields = edit
    ? [
        ...new Set([
          ...Object.keys(edit.data).filter((key) => key in labels && !(edit.kind === "recipient" && key === "department_id")),
          ...(["notice", "group", "recipient"].includes(edit.kind)
            ? ["active"]
            : []),
        ]),
      ]
    : [];
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;
    const f = new FormData(e.currentTarget);
    const updated: Record<string, Json> = { ...edit.data };
    for (const key of fields) {
      switch (key) {
        case "recipients":
          updated[key] = f
            .getAll(key)
            .filter((x): x is string => typeof x === "string");
          break;
        case "emails":
          updated[key] = value(f, key)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          break;
        case "active":
          updated[key] = value(f, key) === "true";
          break;
        case "renewal_months":
          updated[key] = Number(value(f, key));
          break;
        case "appointment_at":
        case "remind_at":
          updated[key] = new Date(value(f, key)).toISOString();
          break;
        default:
          updated[key] = value(f, key);
      }
    }
    if (edit.kind === "recipient") updated.department_id = null;
    if (edit.kind === "notice" && updated.active !== false && (!Array.isArray(updated.recipients) || updated.recipients.length === 0)) {
      toast.error("Selecione pelo menos um destinatário para o aviso.");
      return;
    }
    void workspace.mutate
      .mutateAsync({
        kind: "record",
        recordKind: edit.kind,
        id: edit.id,
        userId: edit.user_id,
        ...(edit.parent_id ? { parent: edit.parent_id } : {}),
        data: updated,
      })
      .then(() => setEdit(undefined));
  }

  return (
    <>
      <div className="space-y-2">
        {records.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
          >
            <span className="text-sm">
              {text(r.data, "name") ||
                text(r.data, "title") ||
                kinds[r.kind] ||
                "Registo"}
              {r.data.active === false ? " · Inativo" : ""}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit(r)}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemove(r)}>
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={() => setEdit(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar {edit ? kinds[edit.kind] : "registo"}
            </DialogTitle>
            <DialogDescription>
              Atualize os dados e confirme as alterações.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={save}>
            {fields.map((key) => (
              <div key={key}>
                {<RecordField field={key} data={data} edit={edit} />}
              </div>
            ))}
            <Submit busy={workspace.mutate.isPending} />
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!remove} onOpenChange={() => setRemove(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Eliminar {remove ? kinds[remove.kind] : "registo"}?
            </DialogTitle>
            <DialogDescription>
              Confirme a remoção do registo selecionado.
            </DialogDescription>
          </DialogHeader>
          <p>
            Os departamentos e assuntos com pedidos associados não podem ser
            eliminados.
          </p>
          <Button
            variant="destructive"
            disabled={workspace.mutate.isPending}
            onClick={() => {
              if (remove)
                void workspace.mutate
                  .mutateAsync({ kind: "remove", id: remove.id })
                  .then(() => setRemove(undefined));
            }}
          >
            Eliminar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
