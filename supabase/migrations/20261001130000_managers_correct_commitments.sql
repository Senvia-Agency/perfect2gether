-- Administradores e perfis com Gestão > Compromissos > Gerir (ex.: Diretor
-- Comercial) podem corrigir o compromisso mensal de outro colaborador.
-- As políticas permissivas só autorizavam o próprio utilizador (ou super admin),
-- por isso as restritivas perm_write_* nunca chegavam a ter efeito para terceiros.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_org_commitments(_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org = get_user_org_id(auth.uid())
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_org_admin(auth.uid(), _org)
      OR EXISTS (
        SELECT 1
        FROM organization_members om
        JOIN organization_profiles op ON op.id = om.profile_id
        WHERE om.user_id = auth.uid()
          AND om.organization_id = _org
          AND om.is_active = true
          AND (op.module_permissions->'gestao'->'subareas'->'commitments'->'manage')::text = 'true'
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_manage_org_commitments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_org_commitments(uuid) TO authenticated;

DROP POLICY IF EXISTS "Managers can insert org commitments" ON public.monthly_commitments;
CREATE POLICY "Managers can insert org commitments" ON public.monthly_commitments
FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_org_commitments(organization_id)
  AND public.is_org_member(user_id, organization_id)
);

DROP POLICY IF EXISTS "Managers can update org commitments" ON public.monthly_commitments;
CREATE POLICY "Managers can update org commitments" ON public.monthly_commitments
FOR UPDATE TO authenticated
USING (public.can_manage_org_commitments(organization_id))
WITH CHECK (
  public.can_manage_org_commitments(organization_id)
  AND public.is_org_member(user_id, organization_id)
);

DROP POLICY IF EXISTS "Managers can delete org commitments" ON public.monthly_commitments;
CREATE POLICY "Managers can delete org commitments" ON public.monthly_commitments
FOR DELETE TO authenticated
USING (public.can_manage_org_commitments(organization_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
