
-- =============================================
-- 1. Tabela bank_accounts
-- =============================================
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  iban TEXT,
  holder_name TEXT,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org bank accounts"
  ON public.bank_accounts FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert org bank accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update org bank accounts"
  ON public.bank_accounts FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can delete org bank accounts"
  ON public.bank_accounts FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. Tabela bank_account_transactions
-- =============================================
CREATE TABLE public.bank_account_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'initial_balance' | 'payment_in' | 'expense_out' | 'adjustment'
  amount NUMERIC NOT NULL,
  running_balance NUMERIC NOT NULL DEFAULT 0,
  reference_id UUID,
  reference_type TEXT, -- 'sale_payment' | 'expense'
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_account_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org bank transactions"
  ON public.bank_account_transactions FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert org bank transactions"
  ON public.bank_account_transactions FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update org bank transactions"
  ON public.bank_account_transactions FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can delete org bank transactions"
  ON public.bank_account_transactions FOR DELETE
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_bank_account_transactions_updated_at
  BEFORE UPDATE ON public.bank_account_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bank_account_transactions_account ON public.bank_account_transactions(bank_account_id);
CREATE INDEX idx_bank_account_transactions_ref ON public.bank_account_transactions(reference_id, reference_type);

-- =============================================
-- 3. Adicionar bank_account_id às tabelas existentes
-- =============================================
ALTER TABLE public.expenses ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.sale_payments ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- =============================================
-- 4. Função para calcular running_balance
-- =============================================
CREATE OR REPLACE FUNCTION public.calc_bank_running_balance(_bank_account_id UUID, _transaction_date DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT SUM(amount) FROM bank_account_transactions
     WHERE bank_account_id = _bank_account_id
       AND (transaction_date < _transaction_date 
            OR (transaction_date = _transaction_date AND type = 'initial_balance'))),
    0
  );
$$;

-- =============================================
-- 5. Trigger: criar transação de saldo inicial ao criar conta
-- =============================================
CREATE OR REPLACE FUNCTION public.create_initial_balance_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.initial_balance IS NOT NULL AND NEW.initial_balance != 0 THEN
    INSERT INTO bank_account_transactions (
      organization_id, bank_account_id, type, amount, running_balance,
      description, transaction_date
    ) VALUES (
      NEW.organization_id, NEW.id, 'initial_balance', NEW.initial_balance, NEW.initial_balance,
      'Saldo inicial', CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bank_account_initial_balance
  AFTER INSERT ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.create_initial_balance_transaction();

-- =============================================
-- 6. Trigger: sincronizar transações ao inserir/atualizar/eliminar despesas
-- =============================================
CREATE OR REPLACE FUNCTION public.sync_expense_bank_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _running NUMERIC;
BEGIN
  -- DELETE: remover transação associada
  IF TG_OP = 'DELETE' THEN
    DELETE FROM bank_account_transactions
    WHERE reference_id = OLD.id AND reference_type = 'expense';
    RETURN OLD;
  END IF;

  -- UPDATE: se bank_account_id mudou ou foi removido
  IF TG_OP = 'UPDATE' THEN
    -- Remover transação antiga se existia
    IF OLD.bank_account_id IS NOT NULL THEN
      DELETE FROM bank_account_transactions
      WHERE reference_id = OLD.id AND reference_type = 'expense';
    END IF;
  END IF;

  -- INSERT ou UPDATE com bank_account_id definido
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO _running
    FROM bank_account_transactions
    WHERE bank_account_id = NEW.bank_account_id;

    INSERT INTO bank_account_transactions (
      organization_id, bank_account_id, type, amount, running_balance,
      reference_id, reference_type, description, transaction_date
    ) VALUES (
      NEW.organization_id, NEW.bank_account_id, 'expense_out',
      -1 * ABS(NEW.amount),
      _running + (-1 * ABS(NEW.amount)),
      NEW.id, 'expense', NEW.description, NEW.expense_date::date
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expense_bank_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_bank_transaction();

-- =============================================
-- 7. Trigger: sincronizar transações ao inserir/atualizar/eliminar pagamentos
-- =============================================
CREATE OR REPLACE FUNCTION public.sync_payment_bank_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _running NUMERIC;
  _desc TEXT;
BEGIN
  -- DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM bank_account_transactions
    WHERE reference_id = OLD.id AND reference_type = 'sale_payment';
    RETURN OLD;
  END IF;

  -- UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF OLD.bank_account_id IS NOT NULL THEN
      DELETE FROM bank_account_transactions
      WHERE reference_id = OLD.id AND reference_type = 'sale_payment';
    END IF;
  END IF;

  -- INSERT ou UPDATE com bank_account_id
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO _running
    FROM bank_account_transactions
    WHERE bank_account_id = NEW.bank_account_id;

    SELECT COALESCE('Pagamento venda ' || s.code, 'Pagamento') INTO _desc
    FROM sales s WHERE s.id = NEW.sale_id;

    INSERT INTO bank_account_transactions (
      organization_id, bank_account_id, type, amount, running_balance,
      reference_id, reference_type, description, transaction_date
    ) VALUES (
      NEW.organization_id, NEW.bank_account_id, 'payment_in',
      ABS(NEW.amount),
      _running + ABS(NEW.amount),
      NEW.id, 'sale_payment', _desc, NEW.payment_date::date
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_bank_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_bank_transaction();
