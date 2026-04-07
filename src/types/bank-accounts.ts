export interface BankAccount {
  id: string;
  organization_id: string;
  name: string;
  bank_name: string | null;
  iban: string | null;
  holder_name: string | null;
  initial_balance: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BankTransactionType = 'initial_balance' | 'payment_in' | 'expense_out' | 'adjustment';

export interface BankAccountTransaction {
  id: string;
  organization_id: string;
  bank_account_id: string;
  type: BankTransactionType;
  amount: number;
  running_balance: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
}

export const TRANSACTION_TYPE_LABELS: Record<BankTransactionType, string> = {
  initial_balance: 'Saldo Inicial',
  payment_in: 'Pagamento Recebido',
  expense_out: 'Despesa',
  adjustment: 'Ajuste',
};
