import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Eye, Landmark } from 'lucide-react';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { formatCurrency, formatIban } from '@/lib/format';
import { CreateBankAccountModal } from './CreateBankAccountModal';
import { EditBankAccountModal } from './EditBankAccountModal';
import { BankAccountStatementDrawer } from './BankAccountStatementDrawer';
import type { BankAccount } from '@/types/bank-accounts';

export function BankAccountsTab() {
  const { data: accounts, isLoading } = useBankAccounts();
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const [statementAccount, setStatementAccount] = useState<BankAccount | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contas Correntes</h2>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !accounts?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Landmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">Sem contas correntes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione a sua primeira conta bancária para começar a controlar os movimentos.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <BankAccountCard
              key={acc.id}
              account={acc}
              onEdit={() => setEditAccount(acc)}
              onStatement={() => setStatementAccount(acc)}
            />
          ))}
        </div>
      )}

      <CreateBankAccountModal open={createOpen} onOpenChange={setCreateOpen} />
      {editAccount && (
        <EditBankAccountModal account={editAccount} open={!!editAccount} onOpenChange={(o) => !o && setEditAccount(null)} />
      )}
      <BankAccountStatementDrawer account={statementAccount} open={!!statementAccount} onOpenChange={(o) => !o && setStatementAccount(null)} />
    </div>
  );
}

function BankAccountCard({ account, onEdit, onStatement }: { account: BankAccount; onEdit: () => void; onStatement: () => void }) {
  // We compute balance from initial_balance as placeholder; the statement drawer shows real balance
  return (
    <Card className={`relative ${!account.is_active ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{account.name}</CardTitle>
            {account.bank_name && (
              <p className="text-sm text-muted-foreground">{account.bank_name}</p>
            )}
          </div>
          <div className="flex gap-1">
            {account.is_default && <Badge variant="secondary" className="text-xs">Defeito</Badge>}
            {!account.is_active && <Badge variant="outline" className="text-xs">Inativa</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {account.iban && (
          <p className="text-xs text-muted-foreground font-mono">{formatIban(account.iban)}</p>
        )}
        {account.holder_name && (
          <p className="text-xs text-muted-foreground">Titular: {account.holder_name}</p>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onStatement}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            Extracto
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
