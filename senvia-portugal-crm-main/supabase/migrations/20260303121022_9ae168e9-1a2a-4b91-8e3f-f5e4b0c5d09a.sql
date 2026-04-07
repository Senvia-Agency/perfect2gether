
-- Table for monthly metrics targets (admin-defined)
CREATE TABLE public.monthly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  month date NOT NULL,
  op_energia integer NOT NULL DEFAULT 0,
  energia numeric NOT NULL DEFAULT 0,
  op_solar integer NOT NULL DEFAULT 0,
  solar numeric NOT NULL DEFAULT 0,
  op_comissao integer NOT NULL DEFAULT 0,
  comissao numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, month)
);

ALTER TABLE public.monthly_metrics ENABLE ROW LEVEL SECURITY;

-- Members can read org metrics
CREATE POLICY "Members view org monthly_metrics"
  ON public.monthly_metrics FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

-- Admins can manage metrics
CREATE POLICY "Admins manage org monthly_metrics"
  ON public.monthly_metrics FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Super admin full access
CREATE POLICY "Super admin full access monthly_metrics"
  ON public.monthly_metrics FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_monthly_metrics_updated_at
  BEFORE UPDATE ON public.monthly_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
