-- Create CRM Clients table
CREATE TABLE public.crm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Basic Data
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  nif TEXT,
  
  -- Classification
  status TEXT DEFAULT 'active',
  source TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Calculated Metrics
  total_proposals INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view org clients" ON public.crm_clients
  FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users insert org clients" ON public.crm_clients
  FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users update org clients" ON public.crm_clients
  FOR UPDATE USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins delete org clients" ON public.crm_clients
  FOR DELETE USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Super admin full access crm_clients" ON public.crm_clients
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add client_id to proposals and sales tables
ALTER TABLE public.proposals ADD COLUMN client_id UUID REFERENCES public.crm_clients(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN client_id UUID REFERENCES public.crm_clients(id) ON DELETE SET NULL;

-- Update trigger for updated_at
CREATE TRIGGER update_crm_clients_updated_at
  BEFORE UPDATE ON public.crm_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();