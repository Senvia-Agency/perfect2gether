import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { EdpDraftPayload } from "@/lib/edp/validation";

type EdpPreferencesFieldsProps = {
  readonly payload: EdpDraftPayload;
  readonly onChange: (payload: EdpDraftPayload) => void;
};

export function EdpPreferencesFields({ payload, onChange }: EdpPreferencesFieldsProps) {
  const [billingEmailInput, setBillingEmailInput] = useState(payload.billing_email ?? "");

  return (
    <section className="space-y-4" aria-labelledby="edp-preferences-title">
      <div>
        <h3 id="edp-preferences-title" className="text-sm font-semibold">Condições desta venda</h3>
        <p className="text-xs text-muted-foreground">
          Estas escolhas pertencem ao contrato e não substituem os dados gerais do cliente.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BooleanChoice
          label="Débito direto"
          name="edp-direct-debit"
          value={payload.direct_debit}
          onChange={(directDebit) => onChange({ ...payload, direct_debit: directDebit })}
        />
        <BooleanChoice
          label="Fatura eletrónica"
          name="edp-electronic-invoice"
          value={payload.electronic_invoice}
          onChange={(electronicInvoice) => {
            if (electronicInvoice !== true) setBillingEmailInput("");
            onChange({
              ...payload,
              electronic_invoice: electronicInvoice,
              billing_email: electronicInvoice === true ? payload.billing_email : null,
            });
          }}
        />
      </div>

      {payload.electronic_invoice === true && (
        <div className="space-y-2">
          <Label htmlFor="edp-billing-email">Email de faturação</Label>
          <Input
            id="edp-billing-email"
            type="email"
            autoComplete="email"
            value={billingEmailInput}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setBillingEmailInput(value);
              onChange({ ...payload, billing_email: value.length > 0 && event.currentTarget.validity.valid ? value : null });
            }}
            placeholder="faturacao@empresa.test"
          />
          <p className="text-xs text-muted-foreground">
            Guardado apenas nesta venda; não altera o email geral nem o decisor.
          </p>
        </div>
      )}

      {payload.electronic_invoice === false && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>A fatura eletrónica está desativada. Confirme a aprovação necessária com a EDP antes do envio.</p>
        </div>
      )}
    </section>
  );
}

type BooleanChoiceProps = {
  readonly label: string;
  readonly name: string;
  readonly value: boolean | null;
  readonly onChange: (value: boolean | null) => void;
};

function BooleanChoice({ label, name, value, onChange }: BooleanChoiceProps) {
  const selected = value === null ? "unset" : value ? "yes" : "no";

  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <RadioGroup
        name={name}
        value={selected}
        onValueChange={(nextValue) => onChange(toBooleanChoice(nextValue))}
        className="grid grid-cols-3 gap-2"
      >
        <RadioOption name={name} value="yes" label="Sim" />
        <RadioOption name={name} value="no" label="Não" />
        <RadioOption name={name} value="unset" label="Por decidir" />
      </RadioGroup>
    </fieldset>
  );
}

function RadioOption({ name, value, label }: { readonly name: string; readonly value: string; readonly label: string }) {
  const id = `${name}-${value}`;
  return (
    <Label htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs">
      <RadioGroupItem id={id} value={value} />
      {label}
    </Label>
  );
}

function toBooleanChoice(value: string): boolean | null {
  switch (value) {
    case "yes":
      return true;
    case "no":
      return false;
    case "unset":
      return null;
    default:
      throw new TypeError(`Opção booleana EDP inesperada: ${value}`);
  }
}
