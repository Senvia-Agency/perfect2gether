
-- Also add company_name to leads (from previous approved plan)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_name text;

-- Create lead_attachments table
CREATE TABLE public.lead_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  file_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_lead_attachments_lead_id ON public.lead_attachments(lead_id);
CREATE INDEX idx_lead_attachments_org_id ON public.lead_attachments(organization_id);

-- Enable RLS
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view attachments of their organization
CREATE POLICY "Members can view lead attachments"
ON public.lead_attachments FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

-- RLS: Members can insert attachments
CREATE POLICY "Members can insert lead attachments"
ON public.lead_attachments FOR INSERT
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- RLS: Members can delete attachments
CREATE POLICY "Members can delete lead attachments"
ON public.lead_attachments FOR DELETE
USING (public.is_org_member(auth.uid(), organization_id));

-- Storage policies for lead attachments in the invoices bucket
-- Members can upload to their org's leads folder
CREATE POLICY "Members can upload lead attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE public.is_org_member(auth.uid(), id)
  )
);

-- Members can view their org's lead attachments
CREATE POLICY "Members can view lead attachment files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE public.is_org_member(auth.uid(), id)
  )
);

-- Members can delete their org's lead attachments
CREATE POLICY "Members can delete lead attachment files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE public.is_org_member(auth.uid(), id)
  )
);
