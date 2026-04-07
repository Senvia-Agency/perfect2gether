CREATE OR REPLACE FUNCTION public.normalize_chargeback_cpe(p_cpe text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(regexp_replace(upper(COALESCE(p_cpe, '')), '[^A-Z0-9]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.parse_chargeback_amount(p_value text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v text;
  last_comma integer;
  last_dot integer;
BEGIN
  v := trim(COALESCE(p_value, ''));
  IF v = '' THEN
    RETURN 0;
  END IF;

  v := regexp_replace(v, '[^0-9,.-]', '', 'g');
  last_comma := strpos(reverse(v), ',');
  last_dot := strpos(reverse(v), '.');

  IF last_comma > 0 AND last_dot > 0 THEN
    IF last_comma < last_dot THEN
      v := replace(v, '.', '');
      v := replace(v, ',', '.');
    ELSE
      v := replace(v, ',', '');
    END IF;
  ELSIF last_comma > 0 THEN
    v := replace(v, '.', '');
    v := replace(v, ',', '.');
  ELSE
    v := replace(v, ',', '');
  END IF;

  RETURN COALESCE(NULLIF(v, '')::numeric, 0);
EXCEPTION
  WHEN others THEN
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    LEFT JOIN public.organization_profiles op ON op.id = om.profile_id
    WHERE om.user_id = _user_id
      AND om.organization_id = _org_id
      AND om.is_active = true
      AND (
        om.role = 'admin'
        OR op.base_role = 'admin'
      )
  )
  OR public.has_role(_user_id, 'super_admin');
$$;

CREATE TABLE IF NOT EXISTS public.commission_chargeback_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  imported_by uuid NOT NULL,
  file_name text NOT NULL,
  cpe_column_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  matched_rows integer NOT NULL DEFAULT 0,
  unmatched_rows integer NOT NULL DEFAULT 0,
  chargeback_count integer NOT NULL DEFAULT 0,
  total_chargeback_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commission_chargeback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES public.commission_chargeback_imports(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  cpe text NOT NULL,
  normalized_cpe text,
  chargeback_amount numeric NOT NULL DEFAULT 0,
  matched boolean NOT NULL DEFAULT false,
  matched_proposal_cpe_id uuid,
  matched_proposal_id uuid,
  matched_sale_id uuid,
  matched_user_id uuid,
  unmatched_reason text,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT commission_chargeback_items_row_unique UNIQUE (import_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_chargeback_imports_org_created
  ON public.commission_chargeback_imports (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chargeback_items_import
  ON public.commission_chargeback_items (import_id, row_index);

CREATE INDEX IF NOT EXISTS idx_chargeback_items_org_user
  ON public.commission_chargeback_items (organization_id, matched_user_id);

CREATE INDEX IF NOT EXISTS idx_chargeback_items_normalized_cpe
  ON public.commission_chargeback_items (organization_id, normalized_cpe);

ALTER TABLE public.commission_chargeback_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_chargeback_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can view chargeback imports" ON public.commission_chargeback_imports;
CREATE POLICY "Org admins can view chargeback imports"
ON public.commission_chargeback_imports
FOR SELECT
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins can create chargeback imports" ON public.commission_chargeback_imports;
CREATE POLICY "Org admins can create chargeback imports"
ON public.commission_chargeback_imports
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND imported_by = auth.uid());

DROP POLICY IF EXISTS "Org admins can update chargeback imports" ON public.commission_chargeback_imports;
CREATE POLICY "Org admins can update chargeback imports"
ON public.commission_chargeback_imports
FOR UPDATE
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins can delete chargeback imports" ON public.commission_chargeback_imports;
CREATE POLICY "Org admins can delete chargeback imports"
ON public.commission_chargeback_imports
FOR DELETE
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins can view chargeback items" ON public.commission_chargeback_items;
CREATE POLICY "Org admins can view chargeback items"
ON public.commission_chargeback_items
FOR SELECT
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins can create chargeback items" ON public.commission_chargeback_items;
CREATE POLICY "Org admins can create chargeback items"
ON public.commission_chargeback_items
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins can update chargeback items" ON public.commission_chargeback_items;
CREATE POLICY "Org admins can update chargeback items"
ON public.commission_chargeback_items
FOR UPDATE
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins can delete chargeback items" ON public.commission_chargeback_items;
CREATE POLICY "Org admins can delete chargeback items"
ON public.commission_chargeback_items
FOR DELETE
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

CREATE OR REPLACE FUNCTION public.import_commission_chargebacks(
  p_organization_id uuid,
  p_file_name text,
  p_cpe_column_name text,
  p_rows jsonb
)
RETURNS TABLE (
  import_id uuid,
  total_rows integer,
  chargeback_count integer,
  matched_rows integer,
  unmatched_rows integer,
  total_chargeback_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      v_import_id AS import_id,
      p_organization_id AS organization_id,
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
    organization_id,
    import_id,
    row_index,
    cpe,
    normalized_cpe,
    chargeback_amount,
    matched_user_id IS NOT NULL,
    matched_proposal_cpe_id,
    matched_proposal_id,
    matched_sale_id,
    matched_user_id,
    unmatched_reason,
    raw_row
  FROM matched_rows_cte;

  UPDATE public.commission_chargeback_imports i
  SET
    total_rows = stats.total_rows,
    chargeback_count = stats.chargeback_count,
    matched_rows = stats.matched_rows,
    unmatched_rows = stats.unmatched_rows,
    total_chargeback_amount = stats.total_chargeback_amount
  FROM (
    SELECT
      import_id,
      COUNT(*)::integer AS total_rows,
      COUNT(*)::integer AS chargeback_count,
      COUNT(*) FILTER (WHERE matched)::integer AS matched_rows,
      COUNT(*) FILTER (WHERE NOT matched)::integer AS unmatched_rows,
      COALESCE(SUM(chargeback_amount), 0) AS total_chargeback_amount
    FROM public.commission_chargeback_items
    WHERE import_id = v_import_id
    GROUP BY import_id
  ) stats
  WHERE i.id = stats.import_id;

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
$$;