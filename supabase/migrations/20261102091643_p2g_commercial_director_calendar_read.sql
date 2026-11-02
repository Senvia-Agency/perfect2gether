-- Read-only extension for the P2G commercial director; existing policies stay intact.
CREATE POLICY "P2G director reads commercial meetings"
ON public.calendar_events AS PERMISSIVE FOR SELECT TO authenticated
USING (
  organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  AND organization_id = public.get_user_org_id((SELECT auth.uid()))
  AND event_type = 'meeting'
  AND public.has_module_permission(organization_id, 'calendar', 'events', 'view')
  AND EXISTS (
    SELECT 1 FROM public.organization_members actor
    JOIN public.organization_profiles actor_profile
      ON actor_profile.id = actor.profile_id
      AND actor_profile.organization_id = actor.organization_id
    WHERE actor.organization_id = calendar_events.organization_id
      AND actor.user_id = (SELECT auth.uid())
      AND actor.is_active = true
      AND actor_profile.name = 'Diretor Comercial'
  )
  AND EXISTS (
    SELECT 1 FROM public.organization_members owner_member
    JOIN public.organization_profiles owner_profile
      ON owner_profile.id = owner_member.profile_id
      AND owner_profile.organization_id = owner_member.organization_id
    WHERE owner_member.organization_id = calendar_events.organization_id
      AND owner_member.user_id = calendar_events.user_id
      AND owner_member.is_active = true
      AND owner_profile.name IN ('Comercial', 'CE', 'Diretor Comercial')
  )
);
