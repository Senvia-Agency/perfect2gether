CREATE OR REPLACE FUNCTION public.sync_sale_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sale_id uuid;
  _total_paid numeric;
  _sale_total numeric;
  _new_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _sale_id := OLD.sale_id;
  ELSE
    _sale_id := NEW.sale_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _total_paid
  FROM sale_payments
  WHERE sale_id = _sale_id AND status = 'paid';

  SELECT total_value INTO _sale_total
  FROM sales
  WHERE id = _sale_id;

  IF _total_paid <= 0 THEN
    _new_status := 'pending';
  ELSIF _total_paid >= _sale_total THEN
    _new_status := 'paid';
  ELSE
    _new_status := 'partial';
  END IF;

  UPDATE sales
  SET payment_status = _new_status,
      paid_date = CASE WHEN _new_status = 'paid' THEN now() ELSE NULL END
  WHERE id = _sale_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_sale_payment_status
AFTER INSERT OR UPDATE OR DELETE ON public.sale_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_payment_status();