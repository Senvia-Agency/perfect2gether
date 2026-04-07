
DROP POLICY IF EXISTS "Users can view their organization's lists" ON public.client_lists;
DROP POLICY IF EXISTS "Users can create lists in their organization" ON public.client_lists;
DROP POLICY IF EXISTS "Users can update their organization's lists" ON public.client_lists;
DROP POLICY IF EXISTS "Users can delete their organization's lists" ON public.client_lists;

CREATE POLICY "Users can view their organization's lists"
  ON public.client_lists FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can create lists in their organization"
  ON public.client_lists FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can update their organization's lists"
  ON public.client_lists FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Users can delete their organization's lists"
  ON public.client_lists FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));
