
-- Table for admin-defined monthly objectives per collaborator
CREATE TABLE public.monthly_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  month date NOT NULL,
  total_nifs numeric NOT NULL DEFAULT 0,
  total_energia_mwh numeric NOT NULL DEFAULT 0,
  total_solar_kwp numeric NOT NULL DEFAULT 0,
  total_comissao numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, month)
);

ALTER TABLE public.monthly_objectives ENABLE ROW LEVEL SECURITY;

-- All org members can read
CREATE POLICY "Members view org objectives"
  ON public.monthly_objectives FOR SELECT
  USING (organization_id = get_user_org_id(auth.uid()));

-- Only admins can insert
CREATE POLICY "Admins insert objectives"
  ON public.monthly_objectives FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Only admins can update
CREATE POLICY "Admins update objectives"
  ON public.monthly_objectives FOR UPDATE
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Only admins can delete
CREATE POLICY "Admins delete objectives"
  ON public.monthly_objectives FOR DELETE
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Super admin bypass
CREATE POLICY "Super admin full access monthly_objectives"
  ON public.monthly_objectives FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));
