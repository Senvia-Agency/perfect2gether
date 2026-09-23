-- A converted proposal becomes the source record of a sale. Commercial users
-- must not be able to alter it afterwards; Back Office/admin users continue
-- managing the operational data through the sales workspace.

CREATE OR REPLACE FUNCTION public.can_manage_sales_for_organization(_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.organization_profiles op ON op.id = om.profile_id
      WHERE om.user_id = auth.uid()
        AND om.organization_id = _organization_id
        AND om.is_active = true
        AND op.name = 'Back Office'
    );
$$;

CREATE OR REPLACE FUNCTION public.lock_converted_proposal_for_salespeople()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal_id uuid := COALESCE(NEW.id, OLD.id);
  v_organization_id uuid := COALESCE(NEW.organization_id, OLD.organization_id);
BEGIN
  IF EXISTS (SELECT 1 FROM public.sales WHERE proposal_id = v_proposal_id)
     AND NOT public.can_manage_sales_for_organization(v_organization_id) THEN
    RAISE EXCEPTION 'A proposta já foi convertida em venda e só pode ser gerida pelo Back Office';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_converted_proposal_for_salespeople ON public.proposals;
CREATE TRIGGER trg_lock_converted_proposal_for_salespeople
  BEFORE UPDATE OR DELETE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_converted_proposal_for_salespeople();

CREATE OR REPLACE FUNCTION public.lock_converted_proposal_cpes_for_salespeople()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal_id uuid := COALESCE(NEW.proposal_id, OLD.proposal_id);
  v_organization_id uuid;
BEGIN
  SELECT organization_id INTO v_organization_id
  FROM public.proposals
  WHERE id = v_proposal_id;

  IF EXISTS (SELECT 1 FROM public.sales WHERE proposal_id = v_proposal_id)
     AND NOT public.can_manage_sales_for_organization(v_organization_id) THEN
    RAISE EXCEPTION 'Os CPEs de uma proposta convertida em venda só podem ser geridos pelo Back Office';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_converted_proposal_cpes_for_salespeople ON public.proposal_cpes;
CREATE TRIGGER trg_lock_converted_proposal_cpes_for_salespeople
  BEFORE INSERT OR UPDATE OR DELETE ON public.proposal_cpes
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_converted_proposal_cpes_for_salespeople();
