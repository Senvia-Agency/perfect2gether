
-- When initial_balance is updated on bank_accounts, sync the corresponding transaction
CREATE OR REPLACE FUNCTION sync_initial_balance_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.initial_balance IS DISTINCT FROM NEW.initial_balance THEN
    UPDATE public.bank_account_transactions
    SET amount = NEW.initial_balance,
        running_balance = NEW.initial_balance,
        updated_at = now()
    WHERE bank_account_id = NEW.id
      AND type = 'initial_balance';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_bank_account_update_initial_balance
AFTER UPDATE OF initial_balance ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION sync_initial_balance_transaction();
