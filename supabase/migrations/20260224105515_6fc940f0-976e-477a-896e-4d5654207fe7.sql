
-- Add telecom-specific metric columns to crm_clients
ALTER TABLE public.crm_clients
  ADD COLUMN IF NOT EXISTS total_comissao NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_mwh NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_kwp NUMERIC DEFAULT 0;

-- Update the trigger function to also accumulate telecom metrics
CREATE OR REPLACE FUNCTION public.update_client_sales_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE crm_clients SET
      total_sales = (SELECT COUNT(*) FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      total_value = (SELECT COALESCE(SUM(total), 0) FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      total_comissao = (SELECT COALESCE(SUM(comissao), 0) FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      total_mwh = (SELECT COALESCE(SUM(consumo_anual), 0) / 1000.0 FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      total_kwp = (SELECT COALESCE(SUM(kwp), 0) FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      updated_at = now()
    WHERE id = NEW.client_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE crm_clients SET
      total_sales = (SELECT COUNT(*) FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      total_value = (SELECT COALESCE(SUM(total), 0) FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      total_comissao = (SELECT COALESCE(SUM(comissao), 0) FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      total_mwh = (SELECT COALESCE(SUM(consumo_anual), 0) / 1000.0 FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      total_kwp = (SELECT COALESCE(SUM(kwp), 0) FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      updated_at = now()
    WHERE id = OLD.client_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill existing clients
UPDATE crm_clients c SET
  total_comissao = sub.tc,
  total_mwh = sub.tmwh,
  total_kwp = sub.tkwp
FROM (
  SELECT client_id,
    COALESCE(SUM(comissao), 0) AS tc,
    COALESCE(SUM(consumo_anual), 0) / 1000.0 AS tmwh,
    COALESCE(SUM(kwp), 0) AS tkwp
  FROM sales
  WHERE client_id IS NOT NULL
  GROUP BY client_id
) sub
WHERE c.id = sub.client_id;
