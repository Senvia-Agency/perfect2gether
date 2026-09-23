-- A commercial condition can be shared by several CPEs. The consumption and
-- contract data remain on every CPE (they are a proposal snapshot), while the
-- commission belongs to the group and is therefore counted exactly once.

CREATE TABLE IF NOT EXISTS public.proposal_cpe_commission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  total_comissao numeric NOT NULL DEFAULT 0 CHECK (total_comissao >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_cpe_commission_groups_proposal
  ON public.proposal_cpe_commission_groups (proposal_id);

ALTER TABLE public.proposal_cpes
  ADD COLUMN IF NOT EXISTS commission_group_id uuid
  REFERENCES public.proposal_cpe_commission_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_cpes_commission_group
  ON public.proposal_cpes (commission_group_id)
  WHERE commission_group_id IS NOT NULL;

ALTER TABLE public.proposal_cpe_commission_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view proposal CPE commission groups" ON public.proposal_cpe_commission_groups;
CREATE POLICY "Users view proposal CPE commission groups"
  ON public.proposal_cpe_commission_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.proposals p
      WHERE p.id = proposal_cpe_commission_groups.proposal_id
        AND p.organization_id = get_user_org_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admin full access proposal CPE commission groups" ON public.proposal_cpe_commission_groups;
CREATE POLICY "Super admin full access proposal CPE commission groups"
  ON public.proposal_cpe_commission_groups
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_proposal_cpe_commission_group_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_cpe_commission_groups_updated_at ON public.proposal_cpe_commission_groups;
CREATE TRIGGER trg_proposal_cpe_commission_groups_updated_at
  BEFORE UPDATE ON public.proposal_cpe_commission_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_proposal_cpe_commission_group_updated_at();

-- Replaces the CPE snapshot atomically. p_groups is intentionally optional:
-- sales editing can preserve an existing group without creating a duplicate
-- commission; the proposal editor passes the complete group list.
CREATE OR REPLACE FUNCTION public.replace_proposal_cpes(
  p_proposal_id uuid,
  p_cpes jsonb,
  p_groups jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id uuid;
  v_group jsonb;
  v_group_id uuid;
  v_group_source_id text;
  v_group_ids jsonb := '{}'::jsonb;
BEGIN
  SELECT organization_id
  INTO v_organization_id
  FROM public.proposals
  WHERE id = p_proposal_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada';
  END IF;

  IF auth.uid() IS NULL OR NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = v_organization_id
        AND om.is_active = true
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar os CPEs desta proposta';
  END IF;

  IF p_groups IS NOT NULL AND jsonb_typeof(p_groups) <> 'array' THEN
    RAISE EXCEPTION 'A estrutura de grupos de comissão é inválida';
  END IF;

  IF p_cpes IS NULL OR jsonb_typeof(p_cpes) <> 'array' THEN
    RAISE EXCEPTION 'A estrutura de CPEs é inválida';
  END IF;

  -- The converted-proposal trigger on proposal_cpes enforces the Back Office
  -- lock during this delete, so commercial users cannot bypass it via RPC.
  DELETE FROM public.proposal_cpes WHERE proposal_id = p_proposal_id;

  IF p_groups IS NOT NULL THEN
    DELETE FROM public.proposal_cpe_commission_groups WHERE proposal_id = p_proposal_id;

    FOR v_group IN SELECT value FROM jsonb_array_elements(p_groups)
    LOOP
      v_group_source_id := nullif(btrim(v_group ->> 'source_id'), '');
      IF v_group_source_id IS NULL THEN
        RAISE EXCEPTION 'Cada grupo de comissão necessita de um identificador';
      END IF;

      INSERT INTO public.proposal_cpe_commission_groups (proposal_id, total_comissao)
      VALUES (
        p_proposal_id,
        COALESCE(nullif(v_group ->> 'total_comissao', '')::numeric, 0)
      )
      RETURNING id INTO v_group_id;

      v_group_ids := v_group_ids || jsonb_build_object(v_group_source_id, v_group_id::text);
    END LOOP;
  ELSE
    -- A caller preserving groups may only reference groups from this proposal.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_cpes) AS element(value)
      WHERE nullif(btrim(element.value ->> 'commission_group_id'), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.proposal_cpe_commission_groups group_row
          WHERE group_row.id = (element.value ->> 'commission_group_id')::uuid
            AND group_row.proposal_id = p_proposal_id
        )
    ) THEN
      RAISE EXCEPTION 'Grupo de comissão inválido para esta proposta';
    END IF;
  END IF;

  INSERT INTO public.proposal_cpes (
    proposal_id, existing_cpe_id, equipment_type, serial_number, comercializador,
    fidelizacao_start, fidelizacao_end, notes, consumo_anual, duracao_contrato,
    dbl, margem, comissao, contrato_inicio, contrato_fim, service_type,
    modalidade, kwp, commission_group_id
  )
  WITH parsed_cpes AS (
    SELECT value AS payload, ordinality
    FROM jsonb_array_elements(p_cpes) WITH ORDINALITY
  ), resolved_cpes AS (
    SELECT
      payload,
      ordinality,
      COALESCE(
        nullif(v_group_ids ->> nullif(btrim(payload ->> 'commission_group_key'), ''), '')::uuid,
        nullif(btrim(payload ->> 'commission_group_id'), '')::uuid
      ) AS commission_group_id
    FROM parsed_cpes
  ), ranked_cpes AS (
    SELECT *, row_number() OVER (PARTITION BY commission_group_id ORDER BY ordinality) AS group_position
    FROM resolved_cpes
  )
  SELECT
    p_proposal_id,
    nullif(btrim(payload ->> 'existing_cpe_id'), '')::uuid,
    nullif(btrim(payload ->> 'equipment_type'), ''),
    nullif(btrim(payload ->> 'serial_number'), ''),
    nullif(btrim(payload ->> 'comercializador'), ''),
    nullif(btrim(payload ->> 'fidelizacao_start'), '')::date,
    nullif(btrim(payload ->> 'fidelizacao_end'), '')::date,
    nullif(btrim(payload ->> 'notes'), ''),
    nullif(btrim(payload ->> 'consumo_anual'), '')::numeric,
    nullif(btrim(payload ->> 'duracao_contrato'), '')::numeric,
    nullif(btrim(payload ->> 'dbl'), '')::numeric,
    nullif(btrim(payload ->> 'margem'), '')::numeric,
    CASE
      WHEN ranked_cpes.commission_group_id IS NOT NULL AND ranked_cpes.group_position = 1 THEN group_row.total_comissao
      WHEN ranked_cpes.commission_group_id IS NOT NULL THEN 0
      ELSE nullif(btrim(payload ->> 'comissao'), '')::numeric
    END,
    nullif(btrim(payload ->> 'contrato_inicio'), '')::date,
    nullif(btrim(payload ->> 'contrato_fim'), '')::date,
    nullif(btrim(payload ->> 'service_type'), ''),
    nullif(btrim(payload ->> 'modalidade'), ''),
    nullif(btrim(payload ->> 'kwp'), '')::numeric,
    ranked_cpes.commission_group_id
  FROM ranked_cpes
  LEFT JOIN public.proposal_cpe_commission_groups group_row
    ON group_row.id = ranked_cpes.commission_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_proposal_cpes(uuid, jsonb, jsonb) TO authenticated;
