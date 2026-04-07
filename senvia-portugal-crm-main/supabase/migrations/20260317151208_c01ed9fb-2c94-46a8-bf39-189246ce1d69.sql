-- Enforce mutual exclusivity between energia and servicos proposals

CREATE OR REPLACE FUNCTION public.validate_proposal_type_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_has_cpes boolean;
  v_has_servicos boolean;
BEGIN
  v_has_servicos :=
    COALESCE(array_length(NEW.servicos_produtos, 1), 0) > 0
    OR NEW.servicos_details IS NOT NULL
    OR NEW.modelo_servico IS NOT NULL
    OR NEW.kwp IS NOT NULL;

  SELECT EXISTS (
    SELECT 1
    FROM public.proposal_cpes pc
    WHERE pc.proposal_id = NEW.id
  ) INTO v_has_cpes;

  IF NEW.proposal_type = 'energia' THEN
    IF v_has_servicos THEN
      RAISE EXCEPTION 'Propostas de energia não podem conter dados de serviços';
    END IF;
  ELSIF NEW.proposal_type = 'servicos' THEN
    IF v_has_cpes THEN
      RAISE EXCEPTION 'Propostas de serviços não podem conter CPEs';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_proposal_cpe_for_energy_proposal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_proposal_type text;
BEGIN
  SELECT p.proposal_type
  INTO v_proposal_type
  FROM public.proposals p
  WHERE p.id = NEW.proposal_id;

  IF v_proposal_type IS NULL THEN
    RAISE EXCEPTION 'Proposta inválida para CPE';
  END IF;

  IF v_proposal_type <> 'energia' THEN
    RAISE EXCEPTION 'Apenas propostas de energia podem conter CPEs';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_proposal_type_exclusivity_trigger ON public.proposals;
CREATE TRIGGER validate_proposal_type_exclusivity_trigger
BEFORE INSERT OR UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.validate_proposal_type_exclusivity();

DROP TRIGGER IF EXISTS validate_proposal_cpe_for_energy_proposal_trigger ON public.proposal_cpes;
CREATE TRIGGER validate_proposal_cpe_for_energy_proposal_trigger
BEFORE INSERT OR UPDATE ON public.proposal_cpes
FOR EACH ROW
EXECUTE FUNCTION public.validate_proposal_cpe_for_energy_proposal();