
-- Monthly commitments (one per user per month per org)
CREATE TABLE public.monthly_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, month)
);

ALTER TABLE public.monthly_commitments ENABLE ROW LEVEL SECURITY;

-- Members can see commitments in their org
CREATE POLICY "Members can view org commitments"
  ON public.monthly_commitments FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

-- Users can insert their own commitments
CREATE POLICY "Users can insert own commitments"
  ON public.monthly_commitments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

-- Users can update their own commitments
CREATE POLICY "Users can update own commitments"
  ON public.monthly_commitments FOR UPDATE
  USING (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

-- Users can delete their own commitments
CREATE POLICY "Users can delete own commitments"
  ON public.monthly_commitments FOR DELETE
  USING (auth.uid() = user_id AND public.is_org_member(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_monthly_commitments_updated_at
  BEFORE UPDATE ON public.monthly_commitments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Commitment lines
CREATE TABLE public.commitment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES public.monthly_commitments(id) ON DELETE CASCADE,
  nif text NOT NULL,
  energia_mwh numeric NOT NULL DEFAULT 0,
  solar_kwp numeric NOT NULL DEFAULT 0,
  comissao numeric NOT NULL DEFAULT 0,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commitment_lines ENABLE ROW LEVEL SECURITY;

-- Lines inherit access from parent commitment
CREATE POLICY "Members can view commitment lines"
  ON public.commitment_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_id
    AND public.is_org_member(auth.uid(), mc.organization_id)
  ));

CREATE POLICY "Users can insert own commitment lines"
  ON public.commitment_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_id
    AND mc.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own commitment lines"
  ON public.commitment_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_id
    AND mc.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own commitment lines"
  ON public.commitment_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.monthly_commitments mc
    WHERE mc.id = commitment_id
    AND mc.user_id = auth.uid()
  ));
