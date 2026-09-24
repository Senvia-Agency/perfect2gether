-- P2G commercial users may complete the client records assigned to them.
-- Back Office and the other profiles that can view clients already have edit
-- permission. Keep the change scoped to P2G's Comercial profile.

BEGIN;

UPDATE public.organization_profiles
SET module_permissions = jsonb_set(
  module_permissions,
  '{clients,subareas,list,edit}',
  'true'::jsonb,
  true
)
WHERE organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
  AND name = 'Comercial'
  AND module_permissions #>> '{clients,subareas,list,view}' = 'true';

-- The existing UPDATE policy checks the organization and the granular edit
-- permission, but not the row's assignee. Restrict P2G client edits to the
-- same data scope already used by the SELECT policy. Other organizations are
-- unchanged; admins, Back Office and team leaders retain their own scope.
DROP POLICY IF EXISTS p2g_clients_update_visible_scope ON public.crm_clients;
CREATE POLICY p2g_clients_update_visible_scope
  ON public.crm_clients
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.app_can_view_user_data(assigned_to)
  )
  WITH CHECK (
    organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR public.app_can_view_user_data(assigned_to)
  );

COMMIT;
