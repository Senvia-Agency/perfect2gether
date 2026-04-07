ALTER TABLE public.commission_chargeback_imports ADD COLUMN reference_month date;

CREATE OR REPLACE FUNCTION public.import_commission_chargebacks(
  p_organization_id uuid,
  p_file_name text,
  p_cpe_column_name text,
  p_rows jsonb,
  p_reference_month date DEFAULT NULL
)
 RETURNS TABLE(import_id uuid, total_rows integer, chargeback_count integer, matched_rows integer, unmatched_rows integer, total_chargeback_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_import_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_org_admin(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'Not allowed for this organization';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'At least one row is required';
  END IF;

  INSERT INTO public.commission_chargeback_imports (
    organization_id,
    imported_by,
    file_name,
    cpe_column_name,
    reference_month
  ) VALUES (
    p_organization_id,
    auth.uid(),
    COALESCE(NULLIF(trim(p_file_name), ''), 'chargebacks'),
    p_cpe_column_name,
    p_reference_month
  )
  RETURNING id INTO v_import_id;

  WITH parsed_rows AS (
    SELECT
      ord::integer AS row_index,
      obj AS raw_row,
      COALESCE(obj ->> 'cpe', '') AS cpe,
      public.normalize_chargeback_cpe(obj ->> 'cpe') AS normalized_cpe,
      COALESCE(
        obj ->> 'Nome da Empresa',
        obj ->> 'Nome da empresa',
        obj ->> 'nome da empresa',
        ''
      ) AS file_company_name,
      CASE
        WHEN jsonb_typeof(obj -> 'chargeback_amount') = 'number' THEN COALESCE((obj ->> 'chargeback_amount')::numeric, 0)
        ELSE public.parse_chargeback_amount(obj ->> 'chargeback_amount')
      END AS chargeback_amount
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(obj, ord)
  ),
  matched_rows_cte AS (
    SELECT
      pr.*,
      matched_lookup.matched_proposal_cpe_id,
      matched_lookup.matched_proposal_id,
      matched_lookup.matched_sale_id,
      matched_lookup.matched_user_id,
      matched_lookup.system_client_name,
      CASE
        WHEN pr.normalized_cpe IS NULL THEN 'CPE invalido'
        WHEN matched_lookup.matched_proposal_cpe_id IS NULL THEN 'CPE nao encontrado'
        WHEN matched_lookup.matched_user_id IS NULL THEN 'Sem comercial associado'
        WHEN pr.file_company_name <> '' 
             AND matched_lookup.system_client_name IS NOT NULL
             AND immutable_unaccent(lower(matched_lookup.system_client_name)) NOT LIKE '%' || immutable_unaccent(lower(substring(pr.file_company_name from 1 for 6))) || '%'
             AND immutable_unaccent(lower(pr.file_company_name)) NOT LIKE '%' || immutable_unaccent(lower(substring(matched_lookup.system_client_name from 1 for 6))) || '%'
          THEN 'Cliente nao confere (' || COALESCE(matched_lookup.system_client_name, '?') || ' vs ' || pr.file_company_name || ')'
        ELSE NULL
      END AS unmatched_reason
    FROM parsed_rows pr
    LEFT JOIN LATERAL (
      SELECT
        pc.id AS matched_proposal_cpe_id,
        pc.proposal_id AS matched_proposal_id,
        s.id AS matched_sale_id,
        COALESCE(cc.assigned_to, l.assigned_to, s.created_by, p.created_by) AS matched_user_id,
        COALESCE(cc.name, cc.company, l.company_name, l.name) AS system_client_name
      FROM public.proposal_cpes pc
      JOIN public.proposals p ON p.id = pc.proposal_id
      LEFT JOIN public.sales s ON s.proposal_id = p.id AND s.organization_id = p_organization_id
      LEFT JOIN public.crm_clients cc ON cc.id = s.client_id
      LEFT JOIN public.leads l ON l.id = COALESCE(s.lead_id, p.lead_id)
      WHERE p.organization_id = p_organization_id
        AND public.normalize_chargeback_cpe(pc.serial_number) = pr.normalized_cpe
        AND s.id IS NOT NULL
        AND s.status IN ('concluida', 'entregue', 'Concluida', 'Entregue', 'concluded', 'delivered')
      ORDER BY s.created_at DESC NULLS LAST, p.created_at DESC NULLS LAST
      LIMIT 1
    ) AS matched_lookup ON true
  )
  INSERT INTO public.commission_chargeback_items (
    organization_id,
    import_id,
    row_index,
    cpe,
    normalized_cpe,
    chargeback_amount,
    matched,
    matched_proposal_cpe_id,
    matched_proposal_id,
    matched_sale_id,
    matched_user_id,
    unmatched_reason,
    raw_row
  )
  SELECT
    p_organization_id,
    v_import_id,
    mr.row_index,
    mr.cpe,
    mr.normalized_cpe,
    mr.chargeback_amount,
    (mr.matched_proposal_cpe_id IS NOT NULL AND mr.unmatched_reason IS NULL),
    mr.matched_proposal_cpe_id,
    mr.matched_proposal_id,
    mr.matched_sale_id,
    mr.matched_user_id,
    mr.unmatched_reason,
    mr.raw_row
  FROM matched_rows_cte mr;

  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ci.matched = true) AS matched,
      COUNT(*) FILTER (WHERE ci.matched = false) AS unmatched,
      COUNT(*) FILTER (WHERE ci.chargeback_amount <> 0) AS cb_count,
      COALESCE(SUM(ci.chargeback_amount), 0) AS cb_total
    FROM public.commission_chargeback_items ci
    WHERE ci.import_id = v_import_id
  )
  UPDATE public.commission_chargeback_imports imp
  SET total_rows = s.total,
      matched_rows = s.matched,
      unmatched_rows = s.unmatched,
      chargeback_count = s.cb_count,
      total_chargeback_amount = s.cb_total
  FROM stats s
  WHERE imp.id = v_import_id;

  RETURN QUERY
  SELECT
    v_import_id,
    imp.total_rows,
    imp.chargeback_count,
    imp.matched_rows,
    imp.unmatched_rows,
    imp.total_chargeback_amount
  FROM public.commission_chargeback_imports imp
  WHERE imp.id = v_import_id;
END;
$function$