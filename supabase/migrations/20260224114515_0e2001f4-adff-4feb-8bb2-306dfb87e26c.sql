
CREATE OR REPLACE FUNCTION public.update_client_sales_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE crm_clients SET
      total_sales = (SELECT COUNT(*) FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      total_value = (SELECT COALESCE(SUM(total_value), 0) FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      total_comissao = (SELECT COALESCE(SUM(comissao), 0) FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      total_mwh = (SELECT COALESCE(SUM(consumo_anual), 0) / 1000.0 FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      total_kwp = (SELECT COALESCE(SUM(kwp), 0) FROM sales WHERE client_id = NEW.client_id AND organization_id = NEW.organization_id),
      updated_at = now()
    WHERE id = NEW.client_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE crm_clients SET
      total_sales = (SELECT COUNT(*) FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      total_value = (SELECT COALESCE(SUM(total_value), 0) FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      total_comissao = (SELECT COALESCE(SUM(comissao), 0) FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      total_mwh = (SELECT COALESCE(SUM(consumo_anual), 0) / 1000.0 FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      total_kwp = (SELECT COALESCE(SUM(kwp), 0) FROM sales WHERE client_id = OLD.client_id AND organization_id = OLD.organization_id),
      updated_at = now()
    WHERE id = OLD.client_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
