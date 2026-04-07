
-- Update ensure_stripe_auto_lists to include "Subscrição Reativada"
CREATE OR REPLACE FUNCTION public.ensure_stripe_auto_lists(p_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, v.name, v.description, false, true
  FROM (VALUES
    ('Plano Starter', 'Clientes com subscrição Starter ativa'),
    ('Plano Pro', 'Clientes com subscrição Pro ativa'),
    ('Plano Elite', 'Clientes com subscrição Elite ativa'),
    ('Pagamento em Atraso', 'Clientes com pagamento falhado ou past_due'),
    ('Subscrição Cancelada', 'Clientes que cancelaram a subscrição'),
    ('Clientes em Trial', 'Organizações em período de teste gratuito'),
    ('Trial Expirado', 'Organizações cujo trial expirou sem plano'),
    ('Subscrição Reativada', 'Clientes que reativaram a subscrição após cancelamento ou expiração')
  ) AS v(name, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists cl
    WHERE cl.organization_id = p_org_id AND cl.name = v.name AND cl.is_system = true
  );
END;
$function$;

-- Create the list immediately for Senvia Agency
SELECT ensure_stripe_auto_lists('06fe9e1d-9670-45b0-8717-c5a6e90be380'::uuid);
