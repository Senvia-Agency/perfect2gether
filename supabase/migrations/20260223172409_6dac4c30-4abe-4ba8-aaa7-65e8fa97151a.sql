
-- Function to ensure Stripe auto-lists exist for a given org
CREATE OR REPLACE FUNCTION public.ensure_stripe_auto_lists(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Plano Starter', 'Clientes com subscrição Starter ativa', false, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Plano Starter' AND is_system = true
  );

  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Plano Pro', 'Clientes com subscrição Pro ativa', false, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Plano Pro' AND is_system = true
  );

  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Plano Elite', 'Clientes com subscrição Elite ativa', false, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Plano Elite' AND is_system = true
  );

  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Pagamento em Atraso', 'Clientes com pagamento falhado ou past_due', false, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Pagamento em Atraso' AND is_system = true
  );

  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Subscrição Cancelada', 'Clientes que cancelaram a subscrição', false, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Subscrição Cancelada' AND is_system = true
  );
END;
$function$;

-- Create the lists immediately for Senvia Agency
SELECT ensure_stripe_auto_lists('06fe9e1d-9670-45b0-8717-c5a6e90be380');
