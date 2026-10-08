-- Restrict only P2G lead reads; keep permissions and scopes of other modules.
CREATE OR REPLACE FUNCTION public.p2g_can_read_lead(p_organization_id uuid, p_assigned_to uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT p_organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      LEFT JOIN public.organization_profiles op
        ON op.id = om.profile_id AND op.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND om.organization_id = p_organization_id
        AND om.is_active
        AND (p_assigned_to = auth.uid() OR op.base_role = 'admin'
          OR public.has_role(auth.uid(), 'admin'::public.app_role))
    );
$function$;
REVOKE ALL ON FUNCTION public.p2g_can_read_lead(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.p2g_can_read_lead(uuid, uuid) TO authenticated;
DROP POLICY IF EXISTS "P2G leads are own or administrator" ON public.leads;
CREATE POLICY "P2G leads are own or administrator"
ON public.leads AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.p2g_can_read_lead(organization_id, assigned_to));
