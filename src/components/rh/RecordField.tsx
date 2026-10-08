import { Textarea } from "@/components/ui/textarea";
import { Field } from "./Fields";
import { value } from "@/lib/rh/form";
import { text } from "@/lib/rh/schema";
import type { RhRecord, RhSnapshot } from "@/lib/rh/schema";

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
const events = {
  all: "Todos",
  absence: "Ausências",
  birthday: "Aniversários",
  health: "Saúde",
  support: "Suporte",
};
function localDate(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function RecordField({
  field: key,
  data,
  edit,
}: {
  readonly field: string;
  readonly data: RhSnapshot;
  readonly edit: RhRecord | undefined;
}) {
  if (!edit) return null;
  const current = edit.data[key];
  switch (key) {
    case "recipients":
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Destinatários</legend>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded border p-3">
            {data.members.map((m) => (
              <label key={m.user_id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  name={key}
                  value={m.user_id}
                  defaultChecked={
                    Array.isArray(current) && current.includes(m.user_id)
                  }
                />
                {m.full_name || m.email}
              </label>
            ))}
          </div>
        </fieldset>
      );
    case "department_id":
      return (
        <Field name={key} label={labels[key]}>
          <select
            id={key}
            name={key}
            defaultValue={String(current ?? "")}
            className="w-full rounded-md border bg-background p-2"
          >
            <option value="">Todos</option>
            {data.records
              .filter((r) => r.kind === "department")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {text(r.data, "name")}
                </option>
              ))}
          </select>
        </Field>
      );
    case "event":
    case "channel":
    case "active": {
      const choices =
        key === "event"
          ? events
          : key === "channel"
            ? { in_app: "Na aplicação", email: "Email" }
            : { true: "Ativo", false: "Inativo" };
      return (
        <Field name={key} label={labels[key]}>
          <select
            id={key}
            name={key}
            defaultValue={String(
              current ??
                (key === "active"
                  ? true
                  : key === "channel"
                    ? "in_app"
                    : "all"),
            )}
            className="w-full rounded-md border bg-background p-2"
          >
            {Object.entries(choices).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      );
    }
    case "appointment_at":
    case "remind_at":
      return (
        <Field
          name={key}
          label={labels[key]}
          type="datetime-local"
          value={localDate(String(current ?? ""))}
          required
        />
      );
    case "body":
    case "notes":
      return (
        <Field name={key} label={labels[key]}>
          <Textarea
            id={key}
            name={key}
            defaultValue={String(current ?? "")}
            rows={5}
          />
        </Field>
      );
    case "renewal_months":
      return (
        <Field name={key} label={labels[key]}>
          <input
            id={key}
            name={key}
            type="number"
            min={1}
            max={120}
            required
            defaultValue={Number(current ?? 12)}
            className="w-full rounded-md border bg-background p-2"
          />
        </Field>
      );
    default:
      return (
        <Field
          name={key}
          label={labels[key]}
          value={
            Array.isArray(current) ? current.join(", ") : String(current ?? "")
          }
        />
      );
  }
}
