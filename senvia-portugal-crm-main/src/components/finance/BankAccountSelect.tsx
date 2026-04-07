import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useActiveBankAccounts } from '@/hooks/useBankAccounts';
import { Landmark } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function BankAccountSelect({ value, onChange, label = 'Conta Corrente' }: Props) {
  const { data: accounts } = useActiveBankAccounts();

  if (!accounts?.length) return null;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Sem conta associada" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem conta associada</SelectItem>
          {accounts.map((acc) => (
            <SelectItem key={acc.id} value={acc.id}>
              {acc.name}{acc.bank_name ? ` (${acc.bank_name})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
