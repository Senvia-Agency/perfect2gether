
-- Drop existing policies on monthly_commitments
DROP POLICY IF EXISTS "Users can view org commitments" ON public.monthly_commitments;
DROP POLICY IF EXISTS "Users can insert own commitments" ON public.monthly_commitments;
DROP POLICY IF EXISTS "Users can update own commitments" ON public.monthly_commitments;
DROP POLICY IF EXISTS "Users can delete own commitments" ON public.monthly_commitments;

-- Drop existing policies on commitment_lines
DROP POLICY IF EXISTS "Users can view org commitment lines" ON public.commitment_lines;
DROP POLICY IF EXISTS "Users can insert own commitment lines" ON public.commitment_lines;
DROP POLICY IF EXISTS "Users can update own commitment lines" ON public.commitment_lines;
DROP POLICY IF EXISTS "Users can delete own commitment lines" ON public.commitment_lines;

-- monthly_commitments: new policies using get_user_org_id
CREATE POLICY "Users can view org commitments" ON public.monthly_commitments
FOR SELECT TO authenticated
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert own commitments" ON public.monthly_commitments
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update own commitments" ON public.monthly_commitments
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid()))
WITH CHECK (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete own commitments" ON public.monthly_commitments
FOR DELETE TO authenticated
USING (user_id = auth.uid() AND organization_id = get_user_org_id(auth.uid()));

-- commitment_lines: new policies via subquery
CREATE POLICY "Users can view org commitment lines" ON public.commitment_lines
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.monthly_commitments mc
  WHERE mc.id = commitment_lines.commitment_id
  AND mc.organization_id = get_user_org_id(auth.uid())
));

CREATE POLICY "Users can insert own commitment lines" ON public.commitment_lines
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.monthly_commitments mc
  WHERE mc.id = commitment_lines.commitment_id
  AND mc.user_id = auth.uid()
  AND mc.organization_id = get_user_org_id(auth.uid())
));

CREATE POLICY "Users can update own commitment lines" ON public.commitment_lines
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.monthly_commitments mc
  WHERE mc.id = commitment_lines.commitment_id
  AND mc.user_id = auth.uid()
  AND mc.organization_id = get_user_org_id(auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.monthly_commitments mc
  WHERE mc.id = commitment_lines.commitment_id
  AND mc.user_id = auth.uid()
  AND mc.organization_id = get_user_org_id(auth.uid())
));

CREATE POLICY "Users can delete own commitment lines" ON public.commitment_lines
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.monthly_commitments mc
  WHERE mc.id = commitment_lines.commitment_id
  AND mc.user_id = auth.uid()
  AND mc.organization_id = get_user_org_id(auth.uid())
));
