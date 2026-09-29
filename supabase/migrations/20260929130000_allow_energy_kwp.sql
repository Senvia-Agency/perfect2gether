-- kWp also describes solar capacity on an energy proposal. Only service-specific
-- product data should make an energy proposal fail the exclusivity check.
CREATE OR REPLACE FUNCTION public.validate_proposal_type_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_cpes boolean;
  v_has_servicos boolean;
BEGIN
  v_has_servicos :=
    COALESCE(array_length(NEW.servicos_produtos, 1), 0) > 0
    OR NEW.servicos_details IS NOT NULL
    OR NEW.modelo_servico IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM public.proposal_cpes pc
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
$function$;
