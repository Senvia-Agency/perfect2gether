-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create proposals table
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  total_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  proposal_date DATE DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create proposal_products table (items in a proposal)
CREATE TABLE public.proposal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_products ENABLE ROW LEVEL SECURITY;

-- Products RLS policies
CREATE POLICY "Users view org products"
ON public.products FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage org products"
ON public.products FOR ALL
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admin full access products"
ON public.products FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Proposals RLS policies
CREATE POLICY "Users view org proposals"
ON public.proposals FOR SELECT
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users create org proposals"
ON public.proposals FOR INSERT
WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users update org proposals"
ON public.proposals FOR UPDATE
USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins delete org proposals"
ON public.proposals FOR DELETE
USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admin full access proposals"
ON public.proposals FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Proposal products RLS policies (inherit from proposal access)
CREATE POLICY "Users view proposal products"
ON public.proposal_products FOR SELECT
USING (EXISTS (
  SELECT 1 FROM proposals p 
  WHERE p.id = proposal_id 
  AND p.organization_id = get_user_org_id(auth.uid())
));

CREATE POLICY "Users manage proposal products"
ON public.proposal_products FOR ALL
USING (EXISTS (
  SELECT 1 FROM proposals p 
  WHERE p.id = proposal_id 
  AND p.organization_id = get_user_org_id(auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM proposals p 
  WHERE p.id = proposal_id 
  AND p.organization_id = get_user_org_id(auth.uid())
));

CREATE POLICY "Super admin full access proposal_products"
ON public.proposal_products FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();