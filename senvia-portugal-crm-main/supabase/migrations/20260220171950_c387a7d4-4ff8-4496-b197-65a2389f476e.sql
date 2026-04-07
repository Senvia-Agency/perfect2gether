
-- 1. INSERT
DROP POLICY IF EXISTS "Members can insert lead attachments" ON public.lead_attachments;
CREATE POLICY "Members can insert lead attachments" ON public.lead_attachments
  FOR INSERT WITH CHECK (
    is_org_member(auth.uid(), organization_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 2. SELECT
DROP POLICY IF EXISTS "Members can view lead attachments" ON public.lead_attachments;
CREATE POLICY "Members can view lead attachments" ON public.lead_attachments
  FOR SELECT USING (
    is_org_member(auth.uid(), organization_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 3. DELETE
DROP POLICY IF EXISTS "Members can delete lead attachments" ON public.lead_attachments;
CREATE POLICY "Members can delete lead attachments" ON public.lead_attachments
  FOR DELETE USING (
    is_org_member(auth.uid(), organization_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
