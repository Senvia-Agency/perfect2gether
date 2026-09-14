-- O compromisso proprio nao exige a permissao de gestao de outros utilizadores.
-- Mantem as politicas permissivas existentes e a autorizacao de gestao anterior.
BEGIN;

ALTER POLICY perm_write_ins_monthly_commitments ON public.monthly_commitments
WITH CHECK (
  (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id))
  OR public.has_module_permission(organization_id, 'gestao', 'commitments', 'manage')
);

ALTER POLICY perm_write_upd_monthly_commitments ON public.monthly_commitments
USING (
  (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id))
  OR public.has_module_permission(organization_id, 'gestao', 'commitments', 'manage')
)
WITH CHECK (
  (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id))
  OR public.has_module_permission(organization_id, 'gestao', 'commitments', 'manage')
);

ALTER POLICY perm_write_del_monthly_commitments ON public.monthly_commitments
USING (
  (user_id = auth.uid() AND public.is_org_member(auth.uid(), organization_id))
  OR public.has_module_permission(organization_id, 'gestao', 'commitments', 'manage')
);

COMMIT;
