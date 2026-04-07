-- Create internal_requests table
CREATE TABLE public.internal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Quem submeteu
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  
  -- Tipo e detalhes
  request_type TEXT NOT NULL CHECK (request_type IN ('expense', 'vacation', 'invoice')),
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2),
  
  -- Ficheiro anexo
  file_url TEXT,
  
  -- Datas relevantes
  expense_date DATE,
  period_start DATE,
  period_end DATE,
  
  -- Estado e aprovacao
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Pagamento
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_internal_requests_org ON public.internal_requests(organization_id);
CREATE INDEX idx_internal_requests_submitted_by ON public.internal_requests(submitted_by);
CREATE INDEX idx_internal_requests_status ON public.internal_requests(status);

-- Enable RLS
ALTER TABLE public.internal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: Users see their own requests OR admins see all in their org
CREATE POLICY "Users can view their own requests or admins view all"
ON public.internal_requests
FOR SELECT
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND (
    submitted_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

-- INSERT: Any authenticated member can submit
CREATE POLICY "Authenticated users can create requests"
ON public.internal_requests
FOR INSERT
WITH CHECK (
  organization_id = public.get_user_org_id(auth.uid())
  AND submitted_by = auth.uid()
);

-- UPDATE: Submitter can update pending requests OR admins can update any
CREATE POLICY "Users can update own pending or admins can update any"
ON public.internal_requests
FOR UPDATE
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND (
    (submitted_by = auth.uid() AND status = 'pending')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

-- DELETE: Only submitter can delete pending requests
CREATE POLICY "Users can delete their own pending requests"
ON public.internal_requests
FOR DELETE
USING (
  organization_id = public.get_user_org_id(auth.uid())
  AND submitted_by = auth.uid()
  AND status = 'pending'
);

-- Trigger for updated_at
CREATE TRIGGER update_internal_requests_updated_at
BEFORE UPDATE ON public.internal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('internal-requests', 'internal-requests', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own request files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'internal-requests'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files or admins view all"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'internal-requests'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'internal-requests'
  AND auth.uid()::text = (storage.foldername(name))[1]
);