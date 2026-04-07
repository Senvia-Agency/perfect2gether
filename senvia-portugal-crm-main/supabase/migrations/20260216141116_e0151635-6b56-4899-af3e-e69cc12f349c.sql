CREATE OR REPLACE FUNCTION sync_initial_balance_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.initial_balance IS DISTINCT FROM NEW.initial_balance THEN
    -- Atualizar a transacao original de saldo inicial
    UPDATE public.bank_account_transactions
    SET amount = NEW.initial_balance,
        running_balance = NEW.initial_balance,
        updated_at = now()
    WHERE bank_account_id = NEW.id
      AND type = 'initial_balance';

    -- Inserir registo de ajuste no historico
    INSERT INTO public.bank_account_transactions (
      organization_id, bank_account_id, type, amount,
      running_balance, description, transaction_date
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      'adjustment',
      NEW.initial_balance - OLD.initial_balance,
      NEW.initial_balance,
      'Saldo inicial alterado de ' ||
        to_char(OLD.initial_balance, 'FM999G999G990D00') ||
        ' para ' ||
        to_char(NEW.initial_balance, 'FM999G999G990D00'),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;