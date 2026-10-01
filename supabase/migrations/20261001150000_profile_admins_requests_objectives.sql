-- Administradores pelo perfil (organization_profiles.base_role = 'admin') não têm
-- necessariamente o papel global 'admin' em user_roles. is_org_admin cobre ambos.

-- Pedidos Internos: eliminar pedido/documentos em qualquer fase
CREATE OR REPLACE FUNCTION public.can_delete_any_internal_request(_request_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM internal_requests r
    WHERE r.id = _request_id
      AND r.organization_id = get_user_org_id(auth.uid())
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR is_org_admin(auth.uid(), r.organization_id)
        OR has_finance_request_delete_permission(auth.uid())
      )
  )
$$;

DROP POLICY IF EXISTS "Authorized users can delete any request" ON public.internal_requests;
CREATE POLICY "Authorized users can delete any request"
ON public.internal_requests FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_org_admin(auth.uid(), organization_id)
    OR public.has_finance_request_delete_permission(auth.uid())
  )
);

-- Objetivos mensais: só o papel global 'admin' podia gravar
DROP POLICY IF EXISTS "Managers insert objectives" ON public.monthly_objectives;
CREATE POLICY "Managers insert objectives" ON public.monthly_objectives
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_org_commitments(organization_id));

DROP POLICY IF EXISTS "Managers update objectives" ON public.monthly_objectives;
CREATE POLICY "Managers update objectives" ON public.monthly_objectives
FOR UPDATE TO authenticated
USING (public.can_manage_org_commitments(organization_id))
WITH CHECK (public.can_manage_org_commitments(organization_id));

DROP POLICY IF EXISTS "Managers delete objectives" ON public.monthly_objectives;
CREATE POLICY "Managers delete objectives" ON public.monthly_objectives
FOR DELETE TO authenticated
USING (public.can_manage_org_commitments(organization_id));

NOTIFY pgrst, 'reload schema';
