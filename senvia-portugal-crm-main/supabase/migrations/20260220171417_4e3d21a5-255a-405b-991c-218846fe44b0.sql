
-- 1. INSERT
DROP POLICY IF EXISTS "Members can upload lead attachments" ON storage.objects;
CREATE POLICY "Members can upload lead attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'invoices' AND (
      (storage.foldername(name))[1] IN (
        SELECT organizations.id::text FROM organizations
        WHERE is_org_member(auth.uid(), organizations.id)
      )
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 2. SELECT
DROP POLICY IF EXISTS "Members can view lead attachment files" ON storage.objects;
CREATE POLICY "Members can view lead attachment files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'invoices' AND (
      (storage.foldername(name))[1] IN (
        SELECT organizations.id::text FROM organizations
        WHERE is_org_member(auth.uid(), organizations.id)
      )
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 3. DELETE
DROP POLICY IF EXISTS "Members can delete lead attachment files" ON storage.objects;
CREATE POLICY "Members can delete lead attachment files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'invoices' AND (
      (storage.foldername(name))[1] IN (
        SELECT organizations.id::text FROM organizations
        WHERE is_org_member(auth.uid(), organizations.id)
      )
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );
