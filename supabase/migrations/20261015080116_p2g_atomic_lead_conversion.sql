-- Execute under the caller's existing table permissions and RLS policies.
CREATE FUNCTION public.convert_p2g_lead_to_client(_lead uuid, _won_status text DEFAULT NULL)
RETURNS TABLE(client_id uuid, client_created boolean, client_record public.crm_clients)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  source_lead public.leads%ROWTYPE;
  target_client public.crm_clients%ROWTYPE;
  fiscal_nif text;
  cpe_value text;
  cpe_list jsonb;
  created boolean := false;
BEGIN
  IF auth.uid() IS NULL OR public.p2g_mfa_ok() IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão autorizada necessária.' USING ERRCODE='42501';
  END IF;
  SELECT l.* INTO source_lead FROM public.leads l WHERE l.id=_lead FOR UPDATE;
  IF NOT FOUND OR source_lead.organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid THEN
    RAISE EXCEPTION 'Lead indisponível para conversão.' USING ERRCODE='42501';
  END IF;
  IF _won_status IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages s WHERE s.organization_id=source_lead.organization_id
      AND s.key=_won_status AND (s.is_final_positive OR lower(s.name) ~ '(ganho|won|fechado|closed)')
  ) THEN RAISE EXCEPTION 'Selecione uma etapa de lead ganha.' USING ERRCODE='22023'; END IF;
  fiscal_nif := nullif(regexp_replace(source_lead.company_nif,'[[:space:]]','','g'),'');
  -- Same lead and same fiscal identity serialize before choosing or creating a client.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    source_lead.organization_id::text||':conversion:'||coalesce(fiscal_nif,_lead::text),0));
  SELECT c.* INTO target_client FROM public.crm_clients c
  WHERE c.organization_id=source_lead.organization_id AND (
    c.lead_id=_lead OR (fiscal_nif IS NOT NULL AND
      coalesce(nullif(regexp_replace(c.company_nif,'[[:space:]]','','g'),''),
        nullif(regexp_replace(c.nif,'[[:space:]]','','g'),''))=fiscal_nif))
  ORDER BY (c.lead_id=_lead) DESC NULLS LAST,c.created_at,c.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.crm_clients(organization_id,lead_id,name,email,phone,company,company_nif,notes,assigned_to,source,status)
    VALUES(source_lead.organization_id,_lead,coalesce(nullif(source_lead.name,''),source_lead.company_name,'Sem nome'),
      source_lead.email,source_lead.phone,source_lead.company_name,source_lead.company_nif,
      source_lead.notes,source_lead.assigned_to,'lead','active') RETURNING * INTO target_client;
    created := true;
  END IF;
  cpe_list := CASE WHEN jsonb_typeof(source_lead.custom_data->'cpes')='array'
    THEN source_lead.custom_data->'cpes'
    WHEN jsonb_typeof(source_lead.custom_data->'cpe')='string'
    THEN jsonb_build_array(source_lead.custom_data->'cpe') ELSE '[]'::jsonb END;
  FOR cpe_value IN
    SELECT DISTINCT upper(regexp_replace(value #>> '{}','[[:space:]]','','g'))
    FROM jsonb_array_elements(cpe_list) WHERE jsonb_typeof(value)='string'
    ORDER BY 1
  LOOP
    IF cpe_value='' THEN CONTINUE; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.cpes e WHERE e.organization_id=source_lead.organization_id
      AND e.client_id=target_client.id
      AND lower(btrim(e.equipment_type)) NOT IN ('serviços','servicos')
      AND upper(regexp_replace(coalesce(e.serial_number,''),'[[:space:]]','','g'))=cpe_value) THEN
      INSERT INTO public.cpes(organization_id,client_id,equipment_type,serial_number,comercializador,status,notes)
      VALUES(source_lead.organization_id,target_client.id,'Energia',cpe_value,'Outro','active',
        'Criado automaticamente na conversão da Lead #'||left(_lead::text,8));
    END IF;
  END LOOP;
  UPDATE public.proposals p SET client_id=target_client.id
    WHERE p.organization_id=source_lead.organization_id AND p.lead_id=_lead AND p.client_id IS NULL AND (public.can_manage_sales_for_organization(source_lead.organization_id) OR NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.proposal_id=p.id));
  IF public.has_module_permission(source_lead.organization_id,'sales','sales','edit')
    AND public.can_manage_sales_for_organization(source_lead.organization_id) THEN
    UPDATE public.sales s SET client_id=target_client.id
    WHERE s.organization_id=source_lead.organization_id AND s.lead_id=_lead AND s.client_id IS NULL;
  END IF;
  IF _won_status IS NOT NULL THEN
    UPDATE public.leads l SET status=_won_status WHERE l.id=_lead RETURNING l.* INTO source_lead;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sem permissão para atualizar a lead.' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN QUERY SELECT target_client.id,created,target_client;
END;
$$;
REVOKE ALL ON FUNCTION public.convert_p2g_lead_to_client(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_p2g_lead_to_client(uuid,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
