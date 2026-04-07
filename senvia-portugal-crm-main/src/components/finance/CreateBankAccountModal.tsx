import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateBankAccount } from '@/hooks/useBankAccounts';
import { parseLocalizedNumber, formatIban, cleanIban } from '@/lib/format';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBankAccountModal({ open, onOpenChange }: Props) {
  const create = useCreateBankAccount();
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [holderName, setHolderName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    create.mutate(
      {
        name: name.trim(),
        bank_name: bankName.trim() || null,
        iban: cleanIban(iban) || null,
        holder_name: holderName.trim() || null,
        initial_balance: parseLocalizedNumber(initialBalance),
        is_default: isDefault,
      },
      {
        onSuccess: () => {
          setName(''); setBankName(''); setIban(''); setHolderName('');
          setInitialBalance(''); setIsDefault(false);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Conta Corrente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Conta *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Conta Principal" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ex: Millennium BCP" />
            </div>
            <div className="space-y-2">
              <Label>Nome do Titular</Label>
              <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Nome do titular" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>IBAN</Label>
            <Input value={iban} onChange={(e) => setIban(formatIban(e.target.value))} placeholder="PT50 0000 0000 0000 0000 0000 0" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Saldo Inicial (€)</Label>
              <Input value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox id="is-default" checked={isDefault} onCheckedChange={(c) => setIsDefault(c === true)} />
                <Label htmlFor="is-default" className="cursor-pointer">Conta por defeito</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              {create.isPending ? 'A criar...' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
