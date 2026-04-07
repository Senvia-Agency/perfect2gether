
-- Tabela de objetivos de ativações (mensal/anual, energia/servicos)
CREATE TABLE public.activation_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  period_type text NOT NULL,
  proposal_type text NOT NULL,
  month date NOT NULL,
  target_quantity integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id, period_type, proposal_type, month)
);

-- Validation trigger instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_activation_objectives()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.period_type NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'period_type must be monthly or annual';
  END IF;
  IF NEW.proposal_type NOT IN ('energia', 'servicos') THEN
    RAISE EXCEPTION 'proposal_type must be energia or servicos';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_activation_objectives
  BEFORE INSERT OR UPDATE ON public.activation_objectives
  FOR EACH ROW EXECUTE FUNCTION public.validate_activation_objectives();

-- Enable RLS
ALTER TABLE public.activation_objectives ENABLE ROW LEVEL SECURITY;

-- Admins manage
CREATE POLICY "Admins manage activation_objectives"
  ON public.activation_objectives
  FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Members view
CREATE POLICY "Members view activation_objectives"
  ON public.activation_objectives
  FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

-- Super admin
CREATE POLICY "Super admin full access activation_objectives"
  ON public.activation_objectives
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
