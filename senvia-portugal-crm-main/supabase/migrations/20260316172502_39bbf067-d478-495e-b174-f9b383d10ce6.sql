CREATE OR REPLACE FUNCTION public.distribute_prospects_round_robin(
  p_organization_id uuid,
  p_prospect_ids uuid[],
  p_salesperson_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(distributed_count integer, created_leads_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_salespeople uuid[];
  v_count integer := 0;
  v_leads_count integer := 0;
  v_idx integer := 1;
  v_salespeople_len integer;
  v_first_stage text;
  v_prospect record;
  v_assigned_to uuid;
  v_lead_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.is_org_member(auth.uid(), p_organization_id)
    OR public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed for this organization';
  END IF;

  IF p_prospect_ids IS NULL OR COALESCE(array_length(p_prospect_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one prospect must be selected';
  END IF;

  SELECT array_agg(g.user_id ORDER BY g.full_name, g.user_id)
  INTO v_salespeople
  FROM public.get_org_salespeople(p_organization_id) g
  WHERE p_salesperson_ids IS NULL OR g.user_id = ANY(p_salesperson_ids);

  v_salespeople_len := COALESCE(array_length(v_salespeople, 1), 0);
  IF v_salespeople_len = 0 THEN
    RAISE EXCEPTION 'No eligible salespeople found';
  END IF;

  SELECT ps.key INTO v_first_stage
  FROM public.pipeline_stages ps
  WHERE ps.organization_id = p_organization_id
  ORDER BY ps.position ASC
  LIMIT 1;

  FOR v_prospect IN
    SELECT p.*
    FROM public.prospects p
    JOIN unnest(p_prospect_ids) WITH ORDINALITY AS selected_ids(id, ord) ON selected_ids.id = p.id
    WHERE p.organization_id = p_organization_id
      AND p.converted_to_lead = false
      AND p.assigned_to IS NULL
    ORDER BY selected_ids.ord
    FOR UPDATE OF p SKIP LOCKED
  LOOP
    v_assigned_to := v_salespeople[v_idx];

    INSERT INTO public.leads (
      organization_id,
      name,
      email,
      phone,
      company_name,
      company_nif,
      consumo_anual,
      notes,
      assigned_to,
      source,
      status,
      gdpr_consent,
      automation_enabled,
      custom_data
    ) VALUES (
      p_organization_id,
      COALESCE(NULLIF(v_prospect.contact_name, ''), v_prospect.company_name),
      COALESCE(v_prospect.email, 'prospect-' || v_prospect.id || '@placeholder.local'),
      COALESCE(v_prospect.phone, ''),
      v_prospect.company_name,
      v_prospect.nif,
      v_prospect.annual_consumption_kwh,
      v_prospect.observations,
      v_assigned_to,
      'prospect',
      COALESCE(v_first_stage, 'novo'),
      false,
      false,
      jsonb_build_object(
        'prospect_id', v_prospect.id,
        'cpe', v_prospect.cpe,
        'segment', v_prospect.segment,
        'source_file_name', v_prospect.source_file_name,
        'metadata', v_prospect.metadata
      )
    ) RETURNING id INTO v_lead_id;

    UPDATE public.prospects
    SET assigned_to = v_assigned_to,
        assigned_at = now(),
        converted_to_lead = true,
        converted_lead_id = v_lead_id,
        converted_at = now(),
        status = 'distributed'
    WHERE id = v_prospect.id;

    v_count := v_count + 1;
    v_leads_count := v_leads_count + 1;
    v_idx := CASE WHEN v_idx >= v_salespeople_len THEN 1 ELSE v_idx + 1 END;
  END LOOP;

  RETURN QUERY SELECT v_count, v_leads_count;
END;
$function$;