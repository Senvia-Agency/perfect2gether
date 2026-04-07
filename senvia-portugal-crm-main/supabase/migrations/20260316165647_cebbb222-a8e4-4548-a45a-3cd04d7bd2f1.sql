-- Allow super admins to access prospects for Perfect2Gether without direct membership
-- while preserving standard org-member access for normal users.

DROP POLICY IF EXISTS "Prospects are viewable by org members" ON public.prospects;
DROP POLICY IF EXISTS "Prospects can be inserted by org members" ON public.prospects;
DROP POLICY IF EXISTS "Prospects can be updated by org members" ON public.prospects;
DROP POLICY IF EXISTS "Prospects can be deleted by org members" ON public.prospects;

CREATE POLICY "Prospects are viewable by org members or super admins"
ON public.prospects
FOR SELECT
TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Prospects can be inserted by org members or super admins"
ON public.prospects
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Prospects can be updated by org members or super admins"
ON public.prospects
FOR UPDATE
TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Prospects can be deleted by org members or super admins"
ON public.prospects
FOR DELETE
TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE OR REPLACE FUNCTION public.distribute_prospects_round_robin(
  p_organization_id uuid,
  p_quantity integer,
  p_salesperson_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(distributed_count integer, created_leads_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_salespeople UUID[];
  v_count INTEGER := 0;
  v_leads_count INTEGER := 0;
  v_idx INTEGER := 1;
  v_salespeople_len INTEGER;
  v_first_stage TEXT;
  v_prospect RECORD;
  v_assigned_to UUID;
  v_lead_id UUID;
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

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
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
    SELECT *
    FROM public.prospects
    WHERE organization_id = p_organization_id
      AND converted_to_lead = false
      AND assigned_to IS NULL
    ORDER BY imported_at ASC, created_at ASC, id ASC
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
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