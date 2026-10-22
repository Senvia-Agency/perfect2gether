import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { emptyDecisionMaker, isDecisionMakerEmailValid, type DecisionMaker } from "@/lib/decision-makers";

interface DecisionMakersFieldsProps {
  idPrefix: string;
  value: DecisionMaker[];
  onChange: (value: DecisionMaker[]) => void;
}

export function DecisionMakersFields({ idPrefix, value, onChange }: DecisionMakersFieldsProps) {
  const update = (index: number, field: keyof DecisionMaker, text: string) =>
    onChange(value.map((item, i) => (i === index ? { ...item, [field]: text } : item)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, emptyDecisionMaker()]);

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <Label>Decisores *</Label>
        <span className="text-xs text-muted-foreground">
          {value.length} {value.length === 1 ? "decisor" : "decisores"}
        </span>
      </div>

      {value.map((item, index) => {
        const id = `${idPrefix}-decision-maker-${index}`;
        const emailInvalid = !isDecisionMakerEmailValid(item.email);
        return (
          <fieldset key={index} aria-label={`Decisor ${index + 1}`} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Decisor {index + 1}</p>
              {value.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                  aria-label={`Remover decisor ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-name`}>Nome *</Label>
                <Input
                  id={`${id}-name`}
                  value={item.name}
                  onChange={(e) => update(index, "name", e.target.value)}
                  placeholder="Nome do decisor"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-role`}>Cargo</Label>
                <Input
                  id={`${id}-role`}
                  value={item.role}
                  onChange={(e) => update(index, "role", e.target.value)}
                  placeholder="Ex.: Gerente, Dir. Financeiro"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <PhoneInput value={item.phone} onChange={(phone) => update(index, "phone", phone)} placeholder="912 345 678" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input
                  id={`${id}-email`}
                  type="email"
                  value={item.email}
                  onChange={(e) => update(index, "email", e.target.value)}
                  placeholder="email@exemplo.pt"
                  aria-invalid={emailInvalid}
                />
                {emailInvalid && <p className="text-xs text-destructive">Email inválido.</p>}
              </div>
            </div>
          </fieldset>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
        Adicionar decisor
      </Button>
    </div>
  );
}
