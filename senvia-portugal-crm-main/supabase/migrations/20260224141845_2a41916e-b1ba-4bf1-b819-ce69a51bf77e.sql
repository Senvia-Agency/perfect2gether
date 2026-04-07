
DROP POLICY IF EXISTS "Authenticated users can create requests" ON internal_requests;

CREATE POLICY "Authenticated users can create requests"
ON internal_requests FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org_id(auth.uid())
  AND submitted_by = auth.uid()
);
