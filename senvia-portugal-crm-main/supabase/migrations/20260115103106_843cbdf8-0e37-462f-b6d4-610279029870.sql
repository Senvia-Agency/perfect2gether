-- Create sales table for tracking sold proposals
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT sales_status_check CHECK (status IN ('pending', 'in_progress', 'delivered', 'cancelled'))
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admin full access sales"
ON public.sales FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users view org sales"
ON public.sales FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users create org sales"
ON public.sales FOR INSERT
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users update org sales"
ON public.sales FOR UPDATE
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins delete org sales"
ON public.sales FOR DELETE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();