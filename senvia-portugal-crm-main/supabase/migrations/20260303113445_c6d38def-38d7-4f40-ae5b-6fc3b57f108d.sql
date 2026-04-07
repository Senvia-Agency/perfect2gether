
-- Drop orphaned policy
DROP POLICY IF EXISTS "Members can view org commitments" ON public.monthly_commitments;

-- Drop current policies on monthly_commitments
DROP POLICY IF EXISTS "Users can view org commitments" ON public.monthly_commitments;
DROP POLICY IF EXISTS "Users can insert own commitments" ON public.monthly_commitments;
DROP POLICY IF EXISTS "Users can update own commitments" ON public.monthly_commitments;
DROP POLICY IF EXISTS "Users can delete own commitments" ON public.monthly_commitments;

-- Drop current policies on commitment_lines
DROP POLICY IF EXISTS "Users can view org commitment lines" ON public.commitment_lines;
DROP POLICY IF EXISTS "Users can insert own commitment lines" ON public.commitment_lines;
DROP POLICY IF EXISTS "Users can update own commitment lines" ON public.commitment_lines;
DROP POLICY IF EXISTS "Users can delete own commitment lines" ON public.commitment_lines;

-- monthly_commitments: SELECT (org match OR super_admin)
CREATE POLICY "Users can view org commitments" ON public.monthly_commitments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR organization_id = get_user_org_id(auth.uid()));

-- monthly_commitments: INSERT
CREATE POLICY "Users can insert own commitments" ON public.monthly_commitments
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin') OR (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid())));

-- monthly_commitments: UPDATE
CREATE POLICY "Users can update own commitments" ON public.monthly_commitments
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid())))
WITH CHECK (has_role(auth.uid(), 'super_admin') OR (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid())));

-- monthly_commitments: DELETE
CREATE POLICY "Users can delete own commitments" ON public.monthly_commitments
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid())));

-- commitment_lines: SELECT
CREATE POLICY "Users can view org commitment lines" ON public.commitment_lines
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR
  EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_lines.commitment_id
    AND mc.organization_id = get_user_org_id(auth.uid())
  )
);

-- commitment_lines: INSERT
CREATE POLICY "Users can insert own commitment lines" ON public.commitment_lines
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR
  EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_lines.commitment_id
    AND mc.user_id = auth.uid()
    AND mc.organization_id = get_user_org_id(auth.uid())
  )
);

-- commitment_lines: UPDATE
CREATE POLICY "Users can update own commitment lines" ON public.commitment_lines
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR
  EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_lines.commitment_id
    AND mc.user_id = auth.uid()
    AND mc.organization_id = get_user_org_id(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR
  EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_lines.commitment_id
    AND mc.user_id = auth.uid()
    AND mc.organization_id = get_user_org_id(auth.uid())
  )
);

-- commitment_lines: DELETE
CREATE POLICY "Users can delete own commitment lines" ON public.commitment_lines
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR
  EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_lines.commitment_id
    AND mc.user_id = auth.uid()
    AND mc.organization_id = get_user_org_id(auth.uid())
  )
);
