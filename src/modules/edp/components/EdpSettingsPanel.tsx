import { AlertTriangle, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EdpChecklistRule, EdpSettings, EdpSettingsResponse } from "@/lib/edp/validation";
import { parseRecipientList } from "../logic";

type EdpSettingsPanelProps = {
  readonly value: EdpSettingsResponse;
  readonly onSave: (
    expectedRevision: number,
    settings: EdpSettings,
    checklist: readonly EdpChecklistRule[],
  ) => Promise<EdpSettingsResponse>;
};

export function EdpSettingsPanel({ value, onSave }: EdpSettingsPanelProps) {
  const [settings, setSettings] = useState(value.settings);
  const [checklist, setChecklist] = useState<readonly EdpChecklistRule[]>(value.checklist);
  const [toInput, setToInput] = useState(value.settings.to.join("\n"));
  const [ccInput, setCcInput] = useState(value.settings.cc.join("\n"));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSettings(value.settings);
    setChecklist(value.checklist);
    setToInput(value.settings.to.join("\n"));
    setCcInput(value.settings.cc.join("\n"));
  }, [value]);

  const save = async () => {
    setPending(true);
    setMessage(null);
    try {
      const response = await onSave(
        settings.revision,
        { ...settings, to: [...parseRecipientList(toInput)], cc: [...parseRecipientList(ccInput)] },
        checklist.map((rule, position) => ({ ...rule, position })),
      );
      setSettings(response.settings);
      setChecklist(response.checklist);
      setMessage("Configuração EDP guardada.");
    } catch (error) {
      if (error instanceof Error) setMessage(error.message);
      else throw error;
    } finally {
      setPending(false);
    }
  };

  const updateRule = (ruleId: string, patch: Partial<EdpChecklistRule>) => {
    setChecklist((current) => current.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule));
  };

  const addRule = () => {
    setChecklist((current) => [...current, {
      id: crypto.randomUUID(),
      energy_type: "ee",
      category: "documento",
      label: "Nova confirmação",
      required: false,
      position: current.length,
    }]);
  };

  return (
    <section className="space-y-5 rounded-lg border bg-card p-4 sm:p-6" aria-labelledby="edp-settings-title">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 id="edp-settings-title" className="text-base font-semibold">Processo EDP</h2>
          <p className="text-sm text-muted-foreground">Destinatários, assunto e checklist da organização.</p>
        </div>
      </div>

      {!settings.officially_confirmed && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Valores fictícios, ainda não confirmados</AlertTitle>
          <AlertDescription>Esta configuração ainda não foi confirmada oficialmente e não autoriza o envio.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="edp-settings-subject" label="Assunto">
          <Input
            id="edp-settings-subject"
            value={settings.subject_template}
            onChange={(event) => setSettings({ ...settings, subject_template: event.currentTarget.value })}
          />
        </Field>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Remetente configurado</p>
          <p className="font-medium">{settings.sender_name}</p>
          <p className="break-all text-xs text-muted-foreground">{settings.sender_email}</p>
          <p className="mt-2 text-xs font-medium">
            Transporte: {settings.send_enabled
              ? settings.transport === "local_capture" ? "transporte de teste autorizado" : "Brevo autorizado no servidor"
              : "desativado no backend"}
          </p>
        </div>
        <Field id="edp-settings-to" label="Destinatários">
          <Textarea id="edp-settings-to" rows={3} value={toInput} onChange={(event) => setToInput(event.currentTarget.value)} placeholder="edp@example.test" />
        </Field>
        <Field id="edp-settings-cc" label="CC Back Office">
          <Textarea id="edp-settings-cc" rows={3} value={ccInput} onChange={(event) => setCcInput(event.currentTarget.value)} placeholder="bo@example.test" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Separe vários emails por vírgula, ponto e vírgula ou nova linha.</p>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Checklist por tipo de energia</h3>
            <p className="text-xs text-muted-foreground">Começa vazio; não são inventadas regras oficiais.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addRule}>
            <Plus className="mr-2 h-4 w-4" />Adicionar regra
          </Button>
        </div>

        {checklist.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sem regras configuradas.</p>
        ) : checklist.map((rule) => (
          <div key={rule.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[10rem_minmax(8rem,0.7fr)_minmax(12rem,1fr)_auto_auto] md:items-end">
            <Field id={`edp-rule-energy-${rule.id}`} label="Energia">
              <Select value={rule.energy_type} onValueChange={(value) => {
                if (value === "ee" || value === "gn" || value === "ee_gn") updateRule(rule.id, { energy_type: value });
              }}>
                <SelectTrigger id={`edp-rule-energy-${rule.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ee">Eletricidade</SelectItem>
                  <SelectItem value="gn">Gás natural</SelectItem>
                  <SelectItem value="ee_gn">Eletricidade + gás</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id={`edp-rule-category-${rule.id}`} label="Categoria">
              <Input id={`edp-rule-category-${rule.id}`} value={rule.category} onChange={(event) => updateRule(rule.id, { category: event.currentTarget.value })} />
            </Field>
            <Field id={`edp-rule-label-${rule.id}`} label="Confirmação">
              <Input id={`edp-rule-label-${rule.id}`} value={rule.label} onChange={(event) => updateRule(rule.id, { label: event.currentTarget.value })} />
            </Field>
            <Label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs">
              <Checkbox checked={rule.required} onCheckedChange={(checked) => updateRule(rule.id, { required: checked === true })} />
              Obrigatória
            </Label>
            <Button type="button" size="icon" variant="ghost" aria-label={`Remover ${rule.label}`} onClick={() => setChecklist((current) => current.filter((item) => item.id !== rule.id))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
        <Button type="button" onClick={() => void save()} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? "A guardar..." : "Guardar configuração EDP"}
        </Button>
      </div>
    </section>
  );
}

function Field({ id, label, children }: { readonly id: string; readonly label: string; readonly children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
