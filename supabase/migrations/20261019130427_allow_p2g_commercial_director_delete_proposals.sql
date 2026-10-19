-- Add only the missing permissive DELETE path for the P2G director profile.
-- Existing admin policies, restrictive module/MFA policies and converted-sale
-- triggers remain unchanged. No profile settings or other operations change.
BEGIN;

CREATE POLICY "P2G commercial directors delete permitted proposals"
ON public.proposals
AS PERMISSIVE FOR DELETE TO authenticated
USING (
  organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  AND organization_id = public.get_user_org_id((SELECT auth.uid()))
  AND public.has_module_permission(organization_id, 'proposals', 'proposals', 'delete')
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organization_profiles op
      ON op.id = om.profile_id
      AND op.organization_id = om.organization_id
    WHERE om.user_id = (SELECT auth.uid())
      AND om.organization_id = proposals.organization_id
      AND om.is_active = true
      AND op.name = 'Diretor Comercial'
  )
);

COMMIT;
