-- Creation does not request the commercial lead back through SELECT RLS.
-- The caller keeps INSERT policies, MFA and the existing add/assign permissions.
CREATE FUNCTION public.create_p2g_assigned_lead(_lead jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  org constant uuid := '96a3950e-31be-4c6d-abed-b82968c0d7e9';
  new_id uuid := gen_random_uuid();
  owner_id uuid := (_lead->>'assigned_to')::uuid;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_org_id(auth.uid()) IS DISTINCT FROM org
    OR NOT EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.is_active)
    OR public.has_module_permission(org,'leads','kanban','add') IS NOT TRUE
    OR public.has_module_permission(org,'leads','kanban','assign') IS NOT TRUE
    OR public.p2g_mfa_ok() IS NOT TRUE THEN
    RAISE EXCEPTION 'Sem permissão para criar e atribuir a lead.' USING ERRCODE='42501';
  END IF;
  IF owner_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organization_profiles p ON p.id=m.profile_id AND p.organization_id=m.organization_id
    WHERE m.organization_id=org AND m.user_id=owner_id AND m.is_active
      AND p.name IN ('Comercial','CE','Diretor Comercial')
  ) THEN
    RAISE EXCEPTION 'O comercial selecionado não está disponível.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.leads(id,organization_id,created_by,name,email,phone,status,
    company_nif,company_name,notes,source,value,gdpr_consent,automation_enabled,
    temperature,tipologia,consumo_anual,custom_data,assigned_to)
  VALUES(new_id,org,auth.uid(),_lead->>'name',_lead->>'email',_lead->>'phone','new',
    _lead->>'company_nif',_lead->>'company_name',_lead->>'notes',_lead->>'source',
    (_lead->>'value')::numeric,coalesce((_lead->>'gdpr_consent')::boolean,false),
    coalesce((_lead->>'automation_enabled')::boolean,true),coalesce(_lead->>'temperature','cold'),
    _lead->>'tipologia',(_lead->>'consumo_anual')::numeric,coalesce(_lead->'custom_data','{}'::jsonb),owner_id);
  RETURN new_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_p2g_assigned_lead(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_p2g_assigned_lead(jsonb) TO authenticated;

-- A handoff can make the row invisible to its previous owner. Only this owner
-- column is written; no portfolio read permission or table policy is expanded.
CREATE FUNCTION public.assign_p2g_leads(_lead_ids uuid[], _assigned_to uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  org constant uuid := '96a3950e-31be-4c6d-abed-b82968c0d7e9';
  source_lead public.leads%ROWTYPE;
  changed integer := 0;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_org_id(auth.uid()) IS DISTINCT FROM org
    OR NOT EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.is_active)
    OR public.has_module_permission(org,'leads','kanban','assign') IS NOT TRUE
    OR public.p2g_mfa_ok() IS NOT TRUE THEN
    RAISE EXCEPTION 'Sem permissão para atribuir leads.' USING ERRCODE='42501';
  END IF;
  IF coalesce(cardinality(_lead_ids),0)=0 OR cardinality(_lead_ids)>500 OR array_position(_lead_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Selecione entre 1 e 500 leads.' USING ERRCODE='22023';
  END IF;
  IF _assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organization_profiles p ON p.id=m.profile_id AND p.organization_id=m.organization_id
    WHERE m.organization_id=org AND m.user_id=_assigned_to AND m.is_active
      AND p.name IN ('Comercial','CE','Diretor Comercial')
  ) THEN
    RAISE EXCEPTION 'O comercial selecionado não está disponível.' USING ERRCODE='22023';
  END IF;
  FOR source_lead IN SELECT l.* FROM public.leads l WHERE l.id=ANY(_lead_ids) ORDER BY l.id FOR UPDATE LOOP
    IF source_lead.organization_id IS DISTINCT FROM org
      OR public.p2g_can_read_lead(source_lead.organization_id,source_lead.assigned_to) IS NOT TRUE THEN
      RAISE EXCEPTION 'Sem permissão para atribuir uma das leads selecionadas.' USING ERRCODE='42501';
    END IF;
    changed := changed+1;
  END LOOP;
  IF changed <> (SELECT count(DISTINCT i) FROM unnest(_lead_ids) i) THEN
    RAISE EXCEPTION 'Sem permissão para atribuir uma das leads selecionadas.' USING ERRCODE='42501';
  END IF;
  UPDATE public.leads SET assigned_to=_assigned_to WHERE id=ANY(_lead_ids);
  RETURN changed;
END;
$function$;
REVOKE ALL ON FUNCTION public.assign_p2g_leads(uuid[],uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_p2g_leads(uuid[],uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
