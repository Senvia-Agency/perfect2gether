import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { RhSnapshot } from "@/lib/rh/schema";
export function Field({
  label,
  name,
  type = "text",
  value,
  required = false,
  step,
  min,
  max,
  children,
}: {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly value?: string | number;
  readonly required?: boolean;
  readonly step?: number | "any";
  readonly min?: number;
  readonly max?: number;
  readonly children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children ?? (
        <Input
          id={name}
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          step={step ?? (type === "number" ? "any" : undefined)}
          min={min}
          max={max}
        />
      )}
    </div>
  );
}
export function MemberSelect({
  data,
  value,
  name = "user_id",
  label = "Colaborador",
  multiple = false,
}: {
  readonly data: RhSnapshot;
  readonly value?: string;
  readonly name?: string;
  readonly label?: string;
  readonly multiple?: boolean;
}) {
  if (multiple)
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {label.replace(/\s*\(Ctrl[^)]*\)/, "")}
        </legend>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
          {data.members.map((m) => (
            <label key={m.user_id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={name} value={m.user_id} />
              {m.full_name || m.email || m.user_id}
            </label>
          ))}
        </div>
      </fieldset>
    );
  return (
    <Field label={label} name={name}>
      <select
        id={name}
        name={name}
        defaultValue={value}
        className="w-full rounded-md border border-input bg-background p-2 text-sm"
        required
      >
        {data.members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.full_name || m.email || m.user_id}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Submit({
  busy,
  label = "Guardar",
}: {
  readonly busy: boolean;
  readonly label?: string;
}) {
  return (
    <Button type="submit" disabled={busy}>
      {busy ? "A guardar…" : label}
    </Button>
  );
}
