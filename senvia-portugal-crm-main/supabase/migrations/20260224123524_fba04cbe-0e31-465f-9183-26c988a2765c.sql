
CREATE TABLE public.sale_activation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  activation_date date NOT NULL,
  changed_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_activation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org activation history"
  ON public.sale_activation_history FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Members insert org activation history"
  ON public.sale_activation_history FOR INSERT
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Super admin full access sale_activation_history"
  ON public.sale_activation_history FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_sale_activation_history_sale_id ON public.sale_activation_history(sale_id);
