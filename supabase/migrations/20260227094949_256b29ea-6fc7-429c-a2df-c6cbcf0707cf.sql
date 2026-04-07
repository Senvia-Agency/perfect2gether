
-- Commission closings table
CREATE TABLE public.commission_closings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month date NOT NULL,
  closed_by uuid NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  total_commission numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month)
);

-- Commission closing items table
CREATE TABLE public.commission_closing_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closing_id uuid NOT NULL REFERENCES public.commission_closings(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  total_consumo_mwh numeric NOT NULL DEFAULT 0,
  volume_tier text NOT NULL,
  total_commission numeric NOT NULL DEFAULT 0,
  items_detail jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_closing_items ENABLE ROW LEVEL SECURITY;

-- RLS for commission_closings
CREATE POLICY "Members view org commission closings"
  ON public.commission_closings FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins insert commission closings"
  ON public.commission_closings FOR INSERT
  WITH CHECK ((is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins delete commission closings"
  ON public.commission_closings FOR DELETE
  USING ((is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin full access commission_closings"
  ON public.commission_closings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS for commission_closing_items
CREATE POLICY "Members view org commission closing items"
  ON public.commission_closing_items FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins insert commission closing items"
  ON public.commission_closing_items FOR INSERT
  WITH CHECK ((is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins delete commission closing items"
  ON public.commission_closing_items FOR DELETE
  USING ((is_org_member(auth.uid(), organization_id) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin full access commission_closing_items"
  ON public.commission_closing_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));
