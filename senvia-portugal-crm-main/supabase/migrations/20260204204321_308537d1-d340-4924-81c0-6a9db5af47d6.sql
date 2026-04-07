-- Adicionar campo para URL do ficheiro
ALTER TABLE sale_payments 
ADD COLUMN invoice_file_url TEXT;

-- Criar bucket privado para faturas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices', 
  'invoices', 
  false, 
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
);

-- Políticas RLS para o bucket
CREATE POLICY "Org members can upload invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations 
    WHERE id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Org members can read invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations 
    WHERE id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Org members can delete invoices"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations 
    WHERE id = get_user_org_id(auth.uid())
  )
);