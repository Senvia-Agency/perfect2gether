-- Criar bucket público para logos de organizações (50MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('organization-logos', 'organization-logos', true, 52428800);

-- RLS: Admins podem fazer upload de logos
CREATE POLICY "Admins can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos' AND
  public.has_role(auth.uid(), 'admin')
);

-- RLS: Admins podem atualizar logos
CREATE POLICY "Admins can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-logos' AND
  public.has_role(auth.uid(), 'admin')
);

-- RLS: Admins podem eliminar logos
CREATE POLICY "Admins can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-logos' AND
  public.has_role(auth.uid(), 'admin')
);

-- Público pode ver logos (necessário para formulário público)
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'organization-logos');