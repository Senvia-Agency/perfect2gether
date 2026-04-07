
-- 1. Add finance_email column
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS finance_email text;

-- 2. Create function to check finance approve permission
CREATE OR REPLACE FUNCTION public.has_finance_approve_permission(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN organization_profiles op ON op.id = om.profile_id
    WHERE om.user_id = _user_id
      AND om.organization_id = get_user_org_id(_user_id)
      AND (op.module_permissions->'finance'->'subareas'->'requests'->'approve')::text = 'true'
  )
$$;

-- 3. Update SELECT policy
DROP POLICY IF EXISTS "Users can view their own requests or admins view all" ON internal_requests;
CREATE POLICY "Users can view their own requests or authorized view all"
ON internal_requests FOR SELECT TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (
    submitted_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_finance_approve_permission(auth.uid())
  )
);

-- 4. Update UPDATE policy
DROP POLICY IF EXISTS "Users can update own pending or admins can update any" ON internal_requests;
CREATE POLICY "Users can update own pending or authorized can update any"
ON internal_requests FOR UPDATE TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid())
  AND (
    (submitted_by = auth.uid() AND status = 'pending')
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_finance_approve_permission(auth.uid())
  )
);
