-- Create CPEs table for telecom/energy equipment
CREATE TABLE public.cpes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  
  -- Equipment info
  equipment_type TEXT NOT NULL, -- Router, ONT, Decoder, Smart Meter, etc.
  serial_number TEXT,
  
  -- Provider/Comercializador
  comercializador TEXT NOT NULL, -- MEO, NOS, Vodafone, EDP, Galp, etc.
  
  -- Fidelização (contract lock-in period)
  fidelizacao_start DATE,
  fidelizacao_end DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, pending, returned
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cpes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view org cpes"
ON public.cpes FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users insert org cpes"
ON public.cpes FOR INSERT
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users update org cpes"
ON public.cpes FOR UPDATE
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins delete org cpes"
ON public.cpes FOR DELETE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admin full access cpes"
ON public.cpes FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_cpes_updated_at
BEFORE UPDATE ON public.cpes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_cpes_client_id ON public.cpes(client_id);
CREATE INDEX idx_cpes_organization_id ON public.cpes(organization_id);
CREATE INDEX idx_cpes_fidelizacao_end ON public.cpes(fidelizacao_end);