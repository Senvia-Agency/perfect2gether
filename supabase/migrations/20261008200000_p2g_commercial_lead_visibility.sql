-- CE and Diretor Comercial can read the commercial area, excluding BO.
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
-- The old team predicate would otherwise still restrict CE to its own team.
ALTER POLICY "Users read org leads v2" ON public.leads
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND CASE WHEN organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    THEN public.p2g_can_read_lead(organization_id, assigned_to)
    ELSE public.app_can_view_user_data(assigned_to) OR assigned_to IS NULL
  END
);
