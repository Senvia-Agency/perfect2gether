
-- Fix search_path warnings on the 3 new functions
CREATE OR REPLACE FUNCTION public.sync_expense_bank_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _running NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM bank_account_transactions
    WHERE reference_id = OLD.id AND reference_type = 'expense';
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.bank_account_id IS NOT NULL THEN
      DELETE FROM bank_account_transactions
      WHERE reference_id = OLD.id AND reference_type = 'expense';
    END IF;
  END IF;
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO _running
    FROM bank_account_transactions
    WHERE bank_account_id = NEW.bank_account_id;
    INSERT INTO bank_account_transactions (
      organization_id, bank_account_id, type, amount, running_balance,
      reference_id, reference_type, description, transaction_date
    ) VALUES (
      NEW.organization_id, NEW.bank_account_id, 'expense_out',
      -1 * ABS(NEW.amount), _running + (-1 * ABS(NEW.amount)),
      NEW.id, 'expense', NEW.description, NEW.expense_date::date
    );
  END IF;
  RETURN NEW;
END;
$$;

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
  IF TG_OP = 'DELETE' THEN
    DELETE FROM bank_account_transactions
    WHERE reference_id = OLD.id AND reference_type = 'sale_payment';
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.bank_account_id IS NOT NULL THEN
      DELETE FROM bank_account_transactions
      WHERE reference_id = OLD.id AND reference_type = 'sale_payment';
    END IF;
  END IF;
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
      ABS(NEW.amount), _running + ABS(NEW.amount),
      NEW.id, 'sale_payment', _desc, NEW.payment_date::date
    );
  END IF;
  RETURN NEW;
END;
$$;
