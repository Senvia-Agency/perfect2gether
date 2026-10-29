import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  emptyLegalManager,
  isDecisionMakerEmailValid,
  type LegalManager,
} from "@/lib/decision-makers";

interface LegalManagersFieldsProps {
  readonly idPrefix: string;
  readonly value: LegalManager[];
  readonly onChange: (value: LegalManager[]) => void;
}

export function LegalManagersFields({ idPrefix, value, onChange }: LegalManagersFieldsProps) {
  const update = (index: number, field: keyof LegalManager, text: string) => {
    onChange(value.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: text } : item
    )));
  };
  const remove = (index: number) => onChange(value.filter((_, itemIndex) => itemIndex !== index));
  const add = () => onChange([...value, emptyLegalManager()]);

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Gerentes legais</Label>
        <span className="text-xs text-muted-foreground">
          {value.length} {value.length === 1 ? "gerente" : "gerentes"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Um gerente legal não é decisor por omissão. Use o mesmo NIF para reutilizar a pessoa nas duas funções.</p>

      {value.map((item, index) => {
        const id = `${idPrefix}-legal-manager-${index}`;
        const emailInvalid = !isDecisionMakerEmailValid(item.email);
        return (
          <fieldset key={item.id ?? index} aria-label={`Gerente legal ${index + 1}`} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Gerente legal {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
                aria-label={`Remover gerente legal ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-name`}>Nome *</Label>
                <Input
                  id={`${id}-name`}
                  value={item.name}
                  onChange={(event) => update(index, "name", event.target.value)}
                  placeholder="Nome do gerente legal"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-nif`}>NIF</Label>
                <Input
                  id={`${id}-nif`}
                  inputMode="numeric"
                  value={item.nif ?? ""}
                  onChange={(event) => update(index, "nif", event.target.value)}
                  placeholder="NIF da pessoa"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <PhoneInput
                  value={item.phone}
                  onChange={(phone) => update(index, "phone", phone)}
                  placeholder="912 345 678"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input
                  id={`${id}-email`}
                  type="email"
                  value={item.email}
                  onChange={(event) => update(index, "email", event.target.value)}
                  placeholder="email@exemplo.pt"
                  aria-invalid={emailInvalid}
                />
                {emailInvalid && <p className="text-xs text-destructive">Introduza um email válido.</p>}
              </div>
            </div>
          </fieldset>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
        Adicionar gerente legal
      </Button>
    </div>
  );
}
