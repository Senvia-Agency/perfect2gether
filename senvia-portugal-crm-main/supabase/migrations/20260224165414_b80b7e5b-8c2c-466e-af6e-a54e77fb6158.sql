
-- Create support-attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('support-attachments', 'support-attachments', false, 10485760, 
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload
CREATE POLICY "Users upload support attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'support-attachments' AND auth.role() = 'authenticated');

-- RLS: anyone authenticated can read (for signed URLs)
CREATE POLICY "Authenticated read support attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-attachments' AND auth.role() = 'authenticated');

-- Add attachments column to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
