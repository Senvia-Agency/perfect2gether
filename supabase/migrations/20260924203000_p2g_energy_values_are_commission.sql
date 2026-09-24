-- P2G energy amounts represent CPE commission, never the energy margin.
-- Keep the automatic finance receivable aligned with that same commission.
BEGIN;

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
  v_finance_amount numeric;
  v_cpe_count integer;
  v_is_p2g_energy boolean;
BEGIN
  v_is_p2g_energy := NEW.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    AND COALESCE(NEW.proposal_type, 'energia') = 'energia';
  v_finance_amount := COALESCE(NEW.total_value, 0);

  IF v_is_p2g_energy THEN
    SELECT COUNT(*), COALESCE(SUM(c.comissao), 0)
      INTO v_cpe_count, v_finance_amount
    FROM public.proposal_cpes c
    WHERE c.proposal_id = NEW.proposal_id;

    IF v_cpe_count = 0 THEN
      v_finance_amount := COALESCE(NEW.comissao, 0);
    END IF;
  END IF;

  IF NEW.status = 'cancelled' THEN
    DELETE FROM public.sale_payments
    WHERE sale_id = NEW.id AND origin = 'sale_completed' AND status = 'pending';
    RETURN NEW;
  END IF;

  IF NEW.status <> 'delivered' OR v_finance_amount <= 0 THEN
    IF v_is_p2g_energy AND v_finance_amount <= 0 THEN
      DELETE FROM public.sale_payments
      WHERE sale_id = NEW.id AND origin = 'sale_completed' AND status = 'pending';
    END IF;
    RETURN NEW;
  END IF;

  v_payment_date := COALESCE(NEW.due_date, NEW.sale_date, CURRENT_DATE);

  SELECT id INTO v_auto_payment_id
  FROM public.sale_payments
  WHERE sale_id = NEW.id AND origin = 'sale_completed'
  ORDER BY created_at LIMIT 1;

  IF v_auto_payment_id IS NOT NULL THEN
    UPDATE public.sale_payments
    SET amount = v_finance_amount,
        payment_date = v_payment_date,
        notes = 'Gerado automaticamente quando a venda foi concluída.'
    WHERE id = v_auto_payment_id AND status = 'pending';
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.sale_payments WHERE sale_id = NEW.id
  ) INTO v_has_any_payment;

  IF NOT v_has_any_payment THEN
    INSERT INTO public.sale_payments (
      organization_id, sale_id, amount, payment_date, status, origin, notes
    ) VALUES (
      NEW.organization_id, NEW.id, v_finance_amount, v_payment_date, 'pending',
      'sale_completed', 'Gerado automaticamente quando a venda foi concluída.'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Historical P2G energy proposals/sales were sometimes stored with margin
-- in total_value. Reconcile only records with CPEs, without firing emails.
ALTER TABLE public.proposals DISABLE TRIGGER trigger_automation_proposals;
ALTER TABLE public.proposals DISABLE TRIGGER trg_lock_converted_proposal_for_salespeople;
ALTER TABLE public.sales DISABLE TRIGGER trigger_automation_sales;

WITH commission AS (
  SELECT p.id, COALESCE(SUM(c.comissao), 0)::numeric AS amount
  FROM public.proposals p
  JOIN public.proposal_cpes c ON c.proposal_id = p.id
  WHERE p.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    AND COALESCE(p.proposal_type, 'energia') = 'energia'
  GROUP BY p.id
)
UPDATE public.proposals p
SET total_value = commission.amount,
    comissao = commission.amount
FROM commission
WHERE p.id = commission.id
  AND (p.total_value IS DISTINCT FROM commission.amount
       OR p.comissao IS DISTINCT FROM commission.amount);

UPDATE public.sales s
SET total_value = p.total_value,
    subtotal = p.total_value,
    comissao = p.comissao
FROM public.proposals p
WHERE s.proposal_id = p.id
  AND s.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  AND COALESCE(s.proposal_type, 'energia') = 'energia'
  AND (s.total_value IS DISTINCT FROM p.total_value
       OR s.subtotal IS DISTINCT FROM p.total_value
       OR s.comissao IS DISTINCT FROM p.comissao);

ALTER TABLE public.sales ENABLE TRIGGER trigger_automation_sales;
ALTER TABLE public.proposals ENABLE TRIGGER trg_lock_converted_proposal_for_salespeople;
ALTER TABLE public.proposals ENABLE TRIGGER trigger_automation_proposals;

COMMIT;
