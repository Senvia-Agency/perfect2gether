-- A sale is a commercial record. The Finance module, however, is driven by
-- sale_payments. Keep that distinction while making a concluded sale visible
-- as a pending receivable, never as money already received.

ALTER TABLE public.sale_payments
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';

ALTER TABLE public.sale_payments
  DROP CONSTRAINT IF EXISTS sale_payments_origin_check;

ALTER TABLE public.sale_payments
  ADD CONSTRAINT sale_payments_origin_check
  CHECK (origin IN ('manual', 'sale_completed'));

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_completed_origin
  ON public.sale_payments (sale_id)
  WHERE origin = 'sale_completed';

CREATE OR REPLACE FUNCTION public.sync_completed_sale_to_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_payment_id uuid;
  v_has_any_payment boolean;
  v_payment_date date;
BEGIN
  -- A cancelled sale must not leave an automatically-created pending
  -- receivable behind. Human-created payments are intentionally untouched.
  IF NEW.status = 'cancelled' THEN
    DELETE FROM public.sale_payments
    WHERE sale_id = NEW.id
      AND origin = 'sale_completed'
      AND status = 'pending';
    RETURN NEW;
  END IF;

  -- "delivered" is the canonical concluded status in this application.
  -- Other statuses (including "fulfilled") remain operational states and do
  -- not create a financial receivable prematurely.
  IF NEW.status <> 'delivered' OR COALESCE(NEW.total_value, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  v_payment_date := COALESCE(NEW.due_date, NEW.sale_date, CURRENT_DATE);

  SELECT id
    INTO v_auto_payment_id
  FROM public.sale_payments
  WHERE sale_id = NEW.id
    AND origin = 'sale_completed'
  ORDER BY created_at
  LIMIT 1;

  IF v_auto_payment_id IS NOT NULL THEN
    -- Keep the generated receivable in sync only while it has not been paid.
    -- Once the finance team marks it paid, its amount/date become historical.
    UPDATE public.sale_payments
    SET amount = NEW.total_value,
        payment_date = v_payment_date,
        notes = 'Gerado automaticamente quando a venda foi concluída.'
    WHERE id = v_auto_payment_id
      AND status = 'pending';
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.sale_payments WHERE sale_id = NEW.id
  ) INTO v_has_any_payment;

  -- Do not duplicate a payment schedule that the team has already created.
  IF NOT v_has_any_payment THEN
    INSERT INTO public.sale_payments (
      organization_id,
      sale_id,
      amount,
      payment_date,
      status,
      origin,
      notes
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      NEW.total_value,
      v_payment_date,
      'pending',
      'sale_completed',
      'Gerado automaticamente quando a venda foi concluída.'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_completed_sale_to_finance ON public.sales;

CREATE TRIGGER trg_sync_completed_sale_to_finance
  AFTER INSERT OR UPDATE OF status, total_value, due_date, sale_date ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_completed_sale_to_finance();

-- Backfill only the concluded sales that still have no payment records. This
-- is idempotent and deliberately leaves fulfilled/cancelled/manual records
-- unchanged.
INSERT INTO public.sale_payments (
  organization_id,
  sale_id,
  amount,
  payment_date,
  status,
  origin,
  notes
)
SELECT
  s.organization_id,
  s.id,
  s.total_value,
  COALESCE(s.due_date, s.sale_date, CURRENT_DATE),
  'pending',
  'sale_completed',
  'Gerado automaticamente para uma venda já concluída.'
FROM public.sales s
WHERE s.status = 'delivered'
  AND COALESCE(s.total_value, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.sale_payments p
    WHERE p.sale_id = s.id
  );
