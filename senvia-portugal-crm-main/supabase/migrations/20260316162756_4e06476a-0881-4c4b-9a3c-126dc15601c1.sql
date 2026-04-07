-- Prospects module for Perfect2Gether
CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  nif TEXT,
  cpe TEXT,
  segment TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  annual_consumption_kwh NUMERIC,
  observations TEXT,
  source TEXT NOT NULL DEFAULT 'import',
  source_file_name TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by UUID,
  assigned_to UUID,
  assigned_at TIMESTAMPTZ,
  converted_to_lead BOOLEAN NOT NULL DEFAULT false,
  converted_lead_id UUID,
  converted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_prospects_org_created_at ON public.prospects (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_org_assigned_to ON public.prospects (organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_prospects_org_converted ON public.prospects (organization_id, converted_to_lead);
CREATE INDEX IF NOT EXISTS idx_prospects_org_status ON public.prospects (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_prospects_org_nif_cpe ON public.prospects (organization_id, nif, cpe);
CREATE INDEX IF NOT EXISTS idx_prospects_org_email ON public.prospects (organization_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS ux_prospects_org_nif_cpe
ON public.prospects (organization_id, nif, cpe)
WHERE nif IS NOT NULL AND nif <> '' AND cpe IS NOT NULL AND cpe <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_prospects_org_email_unassigned_dedupe
ON public.prospects (organization_id, lower(email))
WHERE email IS NOT NULL AND email <> '' AND converted_to_lead = false;

DROP POLICY IF EXISTS "Org members can view prospects" ON public.prospects;
CREATE POLICY "Org members can view prospects"
ON public.prospects
FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org members can create prospects" ON public.prospects;
CREATE POLICY "Org members can create prospects"
ON public.prospects
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org members can update prospects" ON public.prospects;
CREATE POLICY "Org members can update prospects"
ON public.prospects
FOR UPDATE
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins can delete prospects" ON public.prospects;
CREATE POLICY "Org admins can delete prospects"
ON public.prospects
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = prospects.organization_id
      AND om.is_active = true
      AND om.role IN ('admin', 'super_admin')
  )
);

DROP TRIGGER IF EXISTS update_prospects_updated_at ON public.prospects;
CREATE TRIGGER update_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_org_salespeople(p_org_id UUID)
RETURNS TABLE(user_id UUID, full_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.user_id,
         COALESCE(p.full_name, p.email, 'Comercial') AS full_name
  FROM public.organization_members om
  LEFT JOIN public.organization_profiles op ON op.id = om.profile_id
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.organization_id = p_org_id
    AND om.is_active = true
    AND (
      om.role = 'salesperson'
      OR op.base_role = 'salesperson'
    )
  ORDER BY COALESCE(p.full_name, p.email, om.user_id::text);
$$;

CREATE OR REPLACE FUNCTION public.distribute_prospects_round_robin(
  p_organization_id UUID,
  p_quantity INTEGER,
  p_salesperson_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(distributed_count INTEGER, created_leads_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
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
$$;