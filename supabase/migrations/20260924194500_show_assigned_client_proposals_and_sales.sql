-- O comercial responsável por um cliente deve ver as propostas e vendas desse
-- cliente, mesmo quando o Back Office criou os registos e não existe lead.
-- A mesma regra aplica-se aos pagamentos visíveis através da venda.

CREATE OR REPLACE FUNCTION public.app_can_view_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    p_client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.crm_clients c
      WHERE c.id = p_client_id
        AND public.app_can_view_user_data(c.assigned_to)
    ), false
  );
$fn$;

CREATE OR REPLACE FUNCTION public.app_can_view_sale(p_sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    p_sale_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = p_sale_id
        AND (
          public.app_can_view_user_data(s.created_by)
          OR public.app_can_view_lead(s.lead_id)
          OR public.app_can_view_client(s.client_id)
        )
    ), false
  );
$fn$;

ALTER POLICY "Users view org proposals" ON public.proposals
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      app_can_view_user_data(created_by)
      OR app_can_view_lead(lead_id)
      OR app_can_view_client(client_id)
    )
  );

ALTER POLICY "Users view org sales" ON public.sales
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (
      app_can_view_user_data(created_by)
      OR app_can_view_lead(lead_id)
      OR app_can_view_client(client_id)
    )
  );
