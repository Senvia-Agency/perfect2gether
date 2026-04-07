
-- Trigger to validate servicos_details for Carregadores/Condensadores
CREATE OR REPLACE FUNCTION public.validate_proposal_servicos()
RETURNS TRIGGER AS $$
DECLARE
  produto TEXT;
  detail JSONB;
BEGIN
  -- Only validate servicos proposals
  IF NEW.proposal_type = 'servicos' AND NEW.servicos_produtos IS NOT NULL THEN
    FOREACH produto IN ARRAY NEW.servicos_produtos LOOP
      -- Get detail for this product
      detail := COALESCE(NEW.servicos_details::jsonb -> produto, '{}'::jsonb);
      
      -- Get the config fields for this product
      -- Carregadores requires: valor, kwp, comissao
      IF produto = 'Carregadores' THEN
        IF NOT (
          (detail ->> 'valor')::numeric > 0 AND
          (detail ->> 'kwp')::numeric > 0
        ) THEN
          RAISE EXCEPTION 'Carregadores requer valor e kwp preenchidos (> 0)';
        END IF;
      END IF;
      
      -- Condensadores requires: duracao, valor, kwp, comissao
      IF produto = 'Condensadores' THEN
        IF NOT (
          (detail ->> 'valor')::numeric > 0 AND
          (detail ->> 'kwp')::numeric > 0
        ) THEN
          RAISE EXCEPTION 'Condensadores requer valor e kwp preenchidos (> 0)';
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop if exists to avoid conflicts
DROP TRIGGER IF EXISTS validate_proposal_servicos_trigger ON public.proposals;

CREATE TRIGGER validate_proposal_servicos_trigger
  BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_proposal_servicos();
