import { useState } from "react";
import { TeamOverlapWarning } from "./TeamOverlapWarning";
import { value } from "@/lib/rh/form";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, MemberSelect, Submit } from "./Fields";
import { absenceTypes } from "@/lib/rh/schema";
import type { RhSnapshot, RhAbsence } from "@/lib/rh/schema";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";

export function AbsenceRequestDialog({
  data,
  workspace,
  open,
  setOpen,
  editing,
  batch,
  canManage,
  periods,
  setPeriods,
  save,
}: {
  readonly data: RhSnapshot;
  readonly workspace: ReturnType<typeof useRhWorkspace>;
  readonly open: boolean;
  readonly setOpen: (value: boolean) => void;
  readonly editing: RhAbsence | undefined;
  readonly batch: boolean;
  readonly canManage: boolean;
  readonly periods: string[];
  readonly setPeriods: (value: string[]) => void;
  readonly save: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [overlap, setOverlap] = useState<
    readonly { start_date: string; end_date: string }[]
  >([]);
  const [target, setTarget] = useState(editing?.user_id ?? workspace.userId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {batch
              ? "Marcação em lote"
              : editing
                ? "Remarcar ausência"
                : "Novo pedido de ausência"}
          </DialogTitle>
          <DialogDescription>
            Confirme os períodos e os dados do pedido. As alterações ficam
            registadas no histórico.
          </DialogDescription>
        </DialogHeader>
        <form
          onChange={(e) => {
            const f = new FormData(e.currentTarget);
            setTarget(value(f, "user_id") || workspace.userId);
            setOverlap(
              periods.map((id) => ({
                start_date: value(f, `start-${id}`),
                end_date: value(f, `end-${id}`),
              })),
            );
          }}
          onSubmit={(e) => void save(e)}
          className="space-y-4"
        >
          {canManage &&
            (batch ? (
              <MemberSelect
                data={data}
                name="users"
                multiple
                label="Colaboradores"
              />
            ) : (
              <MemberSelect
                data={data}
                value={editing?.user_id ?? workspace.userId}
              />
            ))}
          <Field label="Tipo de ausência" name="absence_type">
            <select
              id="absence_type"
              name="absence_type"
              defaultValue={editing?.absence_type ?? "vacation"}
              className="w-full rounded-md border bg-background p-2"
            >
              {Object.entries(absenceTypes).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quota" name="allocation">
            <select
              id="allocation"
              name="allocation"
              defaultValue={editing?.allocation ?? "personal"}
              className="w-full rounded-md border bg-background p-2"
            >
              <option value="personal">Quota do colaborador</option>
              {canManage && <option value="company">Reserva da empresa</option>}
            </select>
          </Field>
          {periods.map((id, i) => {
            const p = editing?.periods.find((p) => p.id === id);

            return (
              <fieldset key={id} className="space-y-3 rounded-md border p-3">
                <legend className="px-2 text-sm">Período {i + 1}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    name={`start-${id}`}
                    label="Início"
                    type="date"
                    value={p?.start_date}
                    required
                  />
                  <Field
                    name={`end-${id}`}
                    label="Fim"
                    type="date"
                    value={p?.end_date}
                    required
                  />
                  <Field name={`type-${id}`} label="Duração">
                    <select
                      id={`type-${id}`}
                      name={`type-${id}`}
                      defaultValue={
                        !p || p.period_type === "full_day"
                          ? "full_day"
                          : "partial"
                      }
                      className="w-full rounded-md border bg-background p-2"
                    >
                      <option value="full_day">Dia completo</option>
                      <option value="partial">
                        Horário parcial (máximo 8h)
                      </option>
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      name={`from-${id}`}
                      label="Das"
                      type="time"
                      value={p?.start_time ?? ""}
                    />
                    <Field
                      name={`to-${id}`}
                      label="Às"
                      type="time"
                      value={p?.end_time ?? ""}
                    />
                  </div>
                </div>
                {periods.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPeriods(periods.filter((x) => x !== id))}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover período
                  </Button>
                )}
              </fieldset>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() => setPeriods([...periods, crypto.randomUUID()])}
          >
            Adicionar período
          </Button>
          <Field
            label="Observações / justificação"
            name="notes"
            value={editing?.notes ?? ""}
          />
          {!batch && (
            <Field
              label="Anexos privados (PDF, imagem ou Word, até 20 MB)"
              name="attachments"
            >
              <Input
                id="attachments"
                name="attachments"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.docx"
              />
            </Field>
          )}
          <p className="text-sm text-muted-foreground">
            Férias: antecedência mínima de 48 horas. O saldo e os dias úteis são
            confirmados pelo servidor.
          </p>
          <TeamOverlapWarning data={data} userId={target} periods={overlap} />
          <Submit busy={workspace.mutate.isPending} label="Submeter pedido" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
