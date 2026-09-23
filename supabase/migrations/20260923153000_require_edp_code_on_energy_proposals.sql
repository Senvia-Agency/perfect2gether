-- The EDP proposal code is captured on the proposal, then copied to the sale.
-- Keeping it at the source avoids a second manual entry and makes the sale
-- traceable to its original commercial proposal.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS edp_proposal_number text;

-- Preserve data already captured on sales created from an older proposal.
UPDATE public.proposals p
SET edp_proposal_number = s.edp_proposal_number
FROM public.sales s
WHERE s.proposal_id = p.id
  AND nullif(btrim(coalesce(p.edp_proposal_number, '')), '') IS NULL
  AND nullif(btrim(coalesce(s.edp_proposal_number, '')), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_p2g_energy_proposal_edp_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
     AND coalesce(NEW.proposal_type, 'energia') = 'energia'
     AND nullif(btrim(coalesce(NEW.edp_proposal_number, '')), '') IS NULL THEN
    RAISE EXCEPTION 'O código da proposta EDP é obrigatório para propostas de energia';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_p2g_energy_proposal_edp_code ON public.proposals;
CREATE TRIGGER trg_enforce_p2g_energy_proposal_edp_code
  BEFORE INSERT OR UPDATE OF proposal_type, edp_proposal_number ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_p2g_energy_proposal_edp_code();

-- PostgreSQL executes same-kind triggers alphabetically. This trigger is
-- deliberately named with an "a_" so it fills the sale field before the
-- existing sales guard validates it.
CREATE OR REPLACE FUNCTION public.copy_edp_code_from_proposal_to_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edp_proposal_number text;
  v_service_type text;
  v_modalidade text;
  v_kwp numeric;
BEGIN
  IF NEW.proposal_id IS NOT NULL THEN
    SELECT
      edp_proposal_number,
      service_type,
      modalidade,
      kwp
      INTO
        v_edp_proposal_number,
        v_service_type,
        v_modalidade,
        v_kwp
    FROM public.proposals
    WHERE id = NEW.proposal_id;

    NEW.edp_proposal_number := coalesce(
      nullif(btrim(coalesce(NEW.edp_proposal_number, '')), ''),
      v_edp_proposal_number
    );
    NEW.service_type := coalesce(NEW.service_type, v_service_type);
    NEW.modalidade := coalesce(NEW.modalidade, v_modalidade);
    NEW.kwp := coalesce(NEW.kwp, v_kwp);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_sync_edp_code_from_proposal ON public.sales;
CREATE TRIGGER a_sync_edp_code_from_proposal
  BEFORE INSERT OR UPDATE OF proposal_id, edp_proposal_number ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.copy_edp_code_from_proposal_to_sale();
