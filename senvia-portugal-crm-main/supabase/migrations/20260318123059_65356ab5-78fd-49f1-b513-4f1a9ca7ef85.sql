CREATE OR REPLACE FUNCTION public.import_commission_chargebacks(p_organization_id uuid, p_file_name text, p_cpe_column_name text, p_rows jsonb)
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
    cpe_column_name
  ) VALUES (
    p_organization_id,
    auth.uid(),
    COALESCE(NULLIF(trim(p_file_name), ''), 'chargebacks'),
    p_cpe_column_name
  )
  RETURNING id INTO v_import_id;

  WITH parsed_rows AS (
    SELECT
      ord::integer AS row_index,
      obj AS raw_row,
      COALESCE(obj ->> 'cpe', '') AS cpe,
      public.normalize_chargeback_cpe(obj ->> 'cpe') AS normalized_cpe,
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
      CASE
        WHEN pr.normalized_cpe IS NULL THEN 'CPE inválido'
        WHEN matched_lookup.matched_proposal_cpe_id IS NULL THEN 'CPE não encontrado'
        WHEN matched_lookup.matched_user_id IS NULL THEN 'Sem comercial associado'
        ELSE NULL
      END AS unmatched_reason
    FROM parsed_rows pr
    LEFT JOIN LATERAL (
      SELECT
        pc.id AS matched_proposal_cpe_id,
        pc.proposal_id AS matched_proposal_id,
        s.id AS matched_sale_id,
        COALESCE(cc.assigned_to, l.assigned_to, s.created_by, p.created_by) AS matched_user_id
      FROM public.proposal_cpes pc
      JOIN public.proposals p ON p.id = pc.proposal_id
      LEFT JOIN public.sales s ON s.proposal_id = p.id AND s.organization_id = p_organization_id
      LEFT JOIN public.crm_clients cc ON cc.id = s.client_id
      LEFT JOIN public.leads l ON l.id = COALESCE(s.lead_id, p.lead_id)
      WHERE p.organization_id = p_organization_id
        AND public.normalize_chargeback_cpe(pc.serial_number) = pr.normalized_cpe
      ORDER BY s.created_at DESC NULLS LAST, p.created_at DESC NULLS LAST, pc.created_at DESC NULLS LAST, pc.id DESC
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
    mrc.row_index,
    mrc.cpe,
    mrc.normalized_cpe,
    mrc.chargeback_amount,
    mrc.matched_user_id IS NOT NULL,
    mrc.matched_proposal_cpe_id,
    mrc.matched_proposal_id,
    mrc.matched_sale_id,
    mrc.matched_user_id,
    mrc.unmatched_reason,
    mrc.raw_row
  FROM matched_rows_cte mrc;

  UPDATE public.commission_chargeback_imports ci_upd
  SET
    total_rows = stats.s_total_rows,
    chargeback_count = stats.s_chargeback_count,
    matched_rows = stats.s_matched_rows,
    unmatched_rows = stats.s_unmatched_rows,
    total_chargeback_amount = stats.s_total_chargeback_amount
  FROM (
    SELECT
      ci.import_id AS s_import_id,
      COUNT(*)::integer AS s_total_rows,
      COUNT(*)::integer AS s_chargeback_count,
      COUNT(*) FILTER (WHERE ci.matched)::integer AS s_matched_rows,
      COUNT(*) FILTER (WHERE NOT ci.matched)::integer AS s_unmatched_rows,
      COALESCE(SUM(ci.chargeback_amount), 0) AS s_total_chargeback_amount
    FROM public.commission_chargeback_items ci
    WHERE ci.import_id = v_import_id
    GROUP BY ci.import_id
  ) stats
  WHERE ci_upd.id = stats.s_import_id;

  RETURN QUERY
  SELECT
    i.id,
    i.total_rows,
    i.chargeback_count,
    i.matched_rows,
    i.unmatched_rows,
    i.total_chargeback_amount
  FROM public.commission_chargeback_imports i
  WHERE i.id = v_import_id;
END;
$function$