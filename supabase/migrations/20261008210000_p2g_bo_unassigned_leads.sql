-- Back Office can also read the unassigned P2G queue.
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
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR (op.name = 'Back Office' AND p_assigned_to IS NULL)
          OR (op.name IN ('CE', 'Diretor Comercial') AND EXISTS (
            SELECT 1 FROM public.organization_members owner_member
            JOIN public.organization_profiles owner_profile
              ON owner_profile.id = owner_member.profile_id
              AND owner_profile.organization_id = owner_member.organization_id
            WHERE owner_member.organization_id = p_organization_id
              AND owner_member.user_id = p_assigned_to
              AND owner_profile.name IN ('Comercial', 'CE', 'Diretor Comercial')
          ))
        )
    );
$function$;

-- Authenticated commercial creators own new leads when no owner is supplied.
CREATE FUNCTION public.p2g_default_lead_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF NEW.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    AND NEW.assigned_to IS NULL AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      JOIN public.organization_profiles p ON p.id=m.profile_id AND p.organization_id=m.organization_id
      WHERE m.organization_id=NEW.organization_id AND m.user_id=auth.uid() AND m.is_active
        AND p.name IN ('Comercial','CE','Diretor Comercial')
    ) THEN
    NEW.assigned_to := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.p2g_default_lead_owner() FROM PUBLIC, authenticated, service_role;
CREATE TRIGGER p2g_default_lead_owner BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.p2g_default_lead_owner();
NOTIFY pgrst, 'reload schema';
