CREATE POLICY "Admins can view renewal automation runs in their organization"
ON public.renewal_automation_runs
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Super admins can view all renewal automation runs"
ON public.renewal_automation_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));