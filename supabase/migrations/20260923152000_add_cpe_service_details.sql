-- Structured service details for CPEs. Keep equipment_type and notes intact
-- for backwards compatibility with imports and historical records.

ALTER TABLE public.cpes
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS kwp numeric;

ALTER TABLE public.proposal_cpes
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS kwp numeric;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS modalidade text;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS modalidade text;

ALTER TABLE public.cpes
  DROP CONSTRAINT IF EXISTS cpes_service_type_check;
ALTER TABLE public.cpes
  ADD CONSTRAINT cpes_service_type_check
  CHECK (service_type IS NULL OR service_type IN ('energia', 'gas'));

ALTER TABLE public.proposal_cpes
  DROP CONSTRAINT IF EXISTS proposal_cpes_service_type_check;
ALTER TABLE public.proposal_cpes
  ADD CONSTRAINT proposal_cpes_service_type_check
  CHECK (service_type IS NULL OR service_type IN ('energia', 'gas'));

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_service_type_check;
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_service_type_check
  CHECK (service_type IS NULL OR service_type IN ('energia', 'gas'));

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_service_type_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_service_type_check
  CHECK (service_type IS NULL OR service_type IN ('energia', 'gas'));

ALTER TABLE public.cpes
  DROP CONSTRAINT IF EXISTS cpes_kwp_non_negative;
ALTER TABLE public.cpes
  ADD CONSTRAINT cpes_kwp_non_negative CHECK (kwp IS NULL OR kwp >= 0);

ALTER TABLE public.proposal_cpes
  DROP CONSTRAINT IF EXISTS proposal_cpes_kwp_non_negative;
ALTER TABLE public.proposal_cpes
  ADD CONSTRAINT proposal_cpes_kwp_non_negative CHECK (kwp IS NULL OR kwp >= 0);

-- Backfill only data that can be identified with certainty from the legacy
-- equipment type / import-note format. Uncertain records stay NULL so they
-- can be completed by the Back Office instead of being guessed.
UPDATE public.cpes
SET service_type = CASE
  WHEN equipment_type ILIKE '%gás%' OR equipment_type ILIKE '%gas%' THEN 'gas'
  WHEN equipment_type ILIKE '%energia%' OR equipment_type ILIKE '%elétric%' OR equipment_type ILIKE '%electric%' THEN 'energia'
  ELSE service_type
END
WHERE service_type IS NULL;

UPDATE public.cpes
SET modalidade = btrim((regexp_match(notes, '(?i)(?:^|[|][[:space:]]*)Modalidade:[[:space:]]*([^|]+)'))[1])
WHERE modalidade IS NULL
  AND notes IS NOT NULL
  AND notes ~* '(?:^|[|][[:space:]]*)Modalidade:[[:space:]]*[^|]+';

UPDATE public.cpes
SET kwp = replace((regexp_match(notes, '(?i)(?:^|[|][[:space:]]*)KWP:[[:space:]]*([0-9]+([.,][0-9]+)?)'))[1], ',', '.')::numeric
WHERE kwp IS NULL
  AND notes IS NOT NULL
  AND notes ~* '(?:^|[|][[:space:]]*)KWP:[[:space:]]*[0-9]+';

-- A proposal CPE retains the values captured when the proposal was made. For
-- legacy proposals, copy the linked CPE values without overwriting any data.
UPDATE public.proposal_cpes pc
SET service_type = COALESCE(pc.service_type, c.service_type),
    modalidade = COALESCE(pc.modalidade, c.modalidade),
    kwp = COALESCE(pc.kwp, c.kwp)
FROM public.cpes c
WHERE c.id = pc.existing_cpe_id
  AND (pc.service_type IS NULL OR pc.modalidade IS NULL OR pc.kwp IS NULL);

-- Populate sale/proposal summary fields only where every linked CPE has the
-- same service type. Mixed-service sales intentionally remain NULL at the
-- summary level; their individual CPE cards remain the source of truth.
WITH proposal_details AS (
  SELECT
    proposal_id,
    CASE WHEN count(DISTINCT service_type) FILTER (WHERE service_type IS NOT NULL) = 1
      THEN max(service_type) FILTER (WHERE service_type IS NOT NULL)
      ELSE NULL
    END AS service_type,
    CASE WHEN count(DISTINCT modalidade) FILTER (WHERE modalidade IS NOT NULL) = 1
      THEN max(modalidade) FILTER (WHERE modalidade IS NOT NULL)
      ELSE NULL
    END AS modalidade
  FROM public.proposal_cpes
  GROUP BY proposal_id
)
UPDATE public.proposals p
SET service_type = COALESCE(p.service_type, d.service_type),
    modalidade = COALESCE(p.modalidade, d.modalidade)
FROM proposal_details d
WHERE d.proposal_id = p.id
  AND (p.service_type IS NULL OR p.modalidade IS NULL);

WITH sale_details AS (
  SELECT
    s.id,
    p.service_type,
    p.modalidade,
    (SELECT COALESCE(SUM(pc.kwp), 0) FROM public.proposal_cpes pc WHERE pc.proposal_id = p.id) AS total_kwp
  FROM public.sales s
  JOIN public.proposals p ON p.id = s.proposal_id
)
UPDATE public.sales s
SET service_type = COALESCE(s.service_type, d.service_type),
    modalidade = COALESCE(s.modalidade, d.modalidade),
    kwp = CASE WHEN s.kwp IS NULL AND d.total_kwp > 0 THEN d.total_kwp ELSE s.kwp END
FROM sale_details d
WHERE d.id = s.id;

CREATE INDEX IF NOT EXISTS idx_cpes_service_type ON public.cpes (organization_id, service_type);

-- Client cards already use CPE consumption for MWh. Extend that exact
-- aggregate to kWp so the card represents the client's registered services,
-- not a stale or unrelated sale-level value.
CREATE OR REPLACE FUNCTION public.update_client_total_mwh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  v_client_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.client_id ELSE NEW.client_id END;

  UPDATE public.crm_clients c
  SET total_mwh = COALESCE((
        SELECT SUM(cp.consumo_anual) / 1000.0
        FROM public.cpes cp
        WHERE cp.client_id = v_client_id
          AND cp.consumo_anual IS NOT NULL
      ), 0),
      total_kwp = COALESCE((
        SELECT SUM(cp.kwp)
        FROM public.cpes cp
        WHERE cp.client_id = v_client_id
          AND cp.kwp IS NOT NULL
      ), 0),
      updated_at = now()
  WHERE c.id = v_client_id;

  -- Keep both client cards correct if a CPE is reassigned.
  IF TG_OP = 'UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    UPDATE public.crm_clients c
    SET total_mwh = COALESCE((
          SELECT SUM(cp.consumo_anual) / 1000.0
          FROM public.cpes cp
          WHERE cp.client_id = OLD.client_id
            AND cp.consumo_anual IS NOT NULL
        ), 0),
        total_kwp = COALESCE((
          SELECT SUM(cp.kwp)
          FROM public.cpes cp
          WHERE cp.client_id = OLD.client_id
            AND cp.kwp IS NOT NULL
        ), 0),
        updated_at = now()
    WHERE c.id = OLD.client_id;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_client_total_mwh ON public.cpes;
CREATE TRIGGER trg_update_client_total_mwh
  AFTER INSERT OR UPDATE OF consumo_anual, kwp, client_id OR DELETE ON public.cpes
  FOR EACH ROW EXECUTE FUNCTION public.update_client_total_mwh();

UPDATE public.crm_clients c
SET total_mwh = COALESCE((
      SELECT SUM(cp.consumo_anual) / 1000.0
      FROM public.cpes cp
      WHERE cp.client_id = c.id
        AND cp.consumo_anual IS NOT NULL
    ), 0),
    total_kwp = COALESCE((
      SELECT SUM(cp.kwp)
      FROM public.cpes cp
      WHERE cp.client_id = c.id
        AND cp.kwp IS NOT NULL
    ), 0),
    updated_at = now();
