CREATE TABLE public.client_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> '' AND char_length(name) <= 200),
  nif text CHECK (nif IS NULL OR nif ~ '^[0-9]{9}$'),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  email text CHECK (email IS NULL OR char_length(email) <= 320),
  source text NOT NULL CHECK (source IN ('legacy','manual','mj','crc_lookup')),
  source_ref text,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_metadata) = 'object'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, client_id, organization_id)
);
CREATE UNIQUE INDEX client_people_client_nif_unique ON public.client_people(client_id,nif) WHERE nif IS NOT NULL;
CREATE UNIQUE INDEX client_people_client_source_ref_unique ON public.client_people(client_id,source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX client_people_client_idx ON public.client_people(client_id,created_at,id);

CREATE TABLE public.client_person_roles (
  person_id uuid NOT NULL,
  client_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('decision_maker','legal_manager','shareholder')),
  source text NOT NULL CHECK (source IN ('legacy','manual','mj','crc_lookup')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_person_roles_pkey PRIMARY KEY(person_id,role),
  CONSTRAINT client_person_roles_person_scope_fkey FOREIGN KEY(person_id,client_id,organization_id)
    REFERENCES public.client_people(id,client_id,organization_id) ON DELETE CASCADE
);
CREATE INDEX client_person_roles_client_idx ON public.client_person_roles(client_id,role);

CREATE FUNCTION public.edp_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER client_people_touch_updated_at BEFORE UPDATE ON public.client_people
FOR EACH ROW EXECUTE FUNCTION public.edp_touch_updated_at();

ALTER TABLE public.client_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_person_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_people, public.client_person_roles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.client_people, public.client_person_roles TO authenticated;
GRANT ALL ON public.client_people, public.client_person_roles TO service_role;

CREATE POLICY client_people_select ON public.client_people FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));
CREATE POLICY client_people_insert ON public.client_people FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));
CREATE POLICY client_people_update ON public.client_people FOR UPDATE TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id))
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));
CREATE POLICY client_people_delete ON public.client_people FOR DELETE TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));
CREATE POLICY client_person_roles_select ON public.client_person_roles FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));
CREATE POLICY client_person_roles_insert ON public.client_person_roles FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));
CREATE POLICY client_person_roles_update ON public.client_person_roles FOR UPDATE TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id))
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));
CREATE POLICY client_person_roles_delete ON public.client_person_roles FOR DELETE TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));

CREATE VIEW public.client_people_roles WITH (security_invoker = true) AS
SELECT p.id AS person_id,p.organization_id,p.client_id,p.name,p.nif,p.phone,p.email,
  p.source AS person_source,p.source_ref,p.source_metadata,r.role,r.source AS role_source,
  (btrim(p.name) <> '' AND nullif(btrim(coalesce(p.phone,'')),'') IS NOT NULL
    AND coalesce(p.email,'') ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') AS is_complete,
  p.created_at,p.updated_at
FROM public.client_people p JOIN public.client_person_roles r ON r.person_id=p.id;
GRANT SELECT ON public.client_people_roles TO authenticated,service_role;

DO $$
DECLARE c record; item jsonb; idx integer; pid uuid; raw_name text; raw_nif text; raw_phone text; raw_email text;
  normalized_nif text; legacy_entry jsonb;
BEGIN
  FOR c IN SELECT id,organization_id,created_by,decision_makers FROM public.crm_clients
    WHERE jsonb_typeof(decision_makers)='array'
  LOOP
    FOR item,idx IN SELECT value,ordinality::integer FROM jsonb_array_elements(c.decision_makers) WITH ORDINALITY
    LOOP
      IF jsonb_typeof(item)<>'object' OR nullif(btrim(item->>'name'),'') IS NULL THEN CONTINUE; END IF;
      raw_name:=btrim(item->>'name'); raw_phone:=nullif(btrim(item->>'phone'),''); raw_email:=nullif(btrim(item->>'email'),'');
      raw_nif:=nullif(btrim(item->>'nif'),'');
      normalized_nif:=nullif(regexp_replace(coalesce(raw_nif,''),'[^0-9]','','g'),'');
      IF length(coalesce(normalized_nif,''))<>9 THEN normalized_nif:=NULL; END IF;
      legacy_entry:=jsonb_strip_nulls(jsonb_build_object('index',idx,'name',raw_name,'nif',raw_nif,'phone',raw_phone,'email',raw_email));
      pid:=NULL;
      IF normalized_nif IS NOT NULL THEN
        SELECT id INTO pid FROM public.client_people WHERE client_id=c.id AND nif=normalized_nif;
      END IF;
      IF pid IS NULL THEN
        INSERT INTO public.client_people(organization_id,client_id,name,nif,phone,email,source,source_ref,source_metadata,created_by)
        VALUES(c.organization_id,c.id,left(raw_name,200),normalized_nif,left(raw_phone,40),left(raw_email,320),
          'legacy','decision_makers:'||idx,jsonb_strip_nulls(jsonb_build_object('legacy_index',idx,
          'legacy_raw_nif',raw_nif,'legacy_entries',jsonb_build_array(legacy_entry))),
          CASE WHEN EXISTS(SELECT 1 FROM auth.users user_row WHERE user_row.id=c.created_by) THEN c.created_by END)
        RETURNING id INTO pid;
      ELSE
        UPDATE public.client_people SET phone=coalesce(phone,left(raw_phone,40)),email=coalesce(email,left(raw_email,320)),
          source_metadata=jsonb_set(source_metadata,'{legacy_entries}',
            coalesce(source_metadata->'legacy_entries','[]'::jsonb)||jsonb_build_array(legacy_entry),true)
        WHERE id=pid;
      END IF;
      INSERT INTO public.client_person_roles(person_id,client_id,organization_id,role,source)
      VALUES(pid,c.id,c.organization_id,'decision_maker','legacy') ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

CREATE FUNCTION public.edp_replace_client_people(p_client_id uuid,p_people jsonb,p_allow_unchanged_legacy boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.crm_clients; item jsonb; role_name text; incoming_role_source text; pid uuid; existing public.client_people;
  normalized_nif text; incoming_name text; incoming_phone text; incoming_email text; incoming_source text;
  desired jsonb:='[]'::jsonb; mirrored jsonb; first_name text; unchanged_legacy boolean;
BEGIN
  IF auth.uid() IS NULL OR jsonb_typeof(p_people) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Lista de intervenientes inválida.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO c FROM public.crm_clients WHERE id=p_client_id FOR UPDATE;
  IF NOT FOUND OR c.organization_id<>public.get_user_org_id(auth.uid()) OR NOT public.app_can_view_client(c.id) THEN
    RAISE EXCEPTION 'Cliente indisponível.' USING ERRCODE='42501';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_people) LOOP
    IF jsonb_typeof(item)<>'object' OR jsonb_typeof(item->'roles')<>'array' THEN
      RAISE EXCEPTION 'Interveniente inválido.' USING ERRCODE='22023';
    END IF;
    IF item?'source_metadata' AND jsonb_typeof(item->'source_metadata')<>'object' THEN
      RAISE EXCEPTION 'Metadados de interveniente inválidos.' USING ERRCODE='22023';
    END IF;
    incoming_name:=btrim(regexp_replace(coalesce(item->>'name',''),'[[:space:]]+',' ','g'));
    incoming_phone:=nullif(btrim(item->>'phone'),''); incoming_email:=nullif(btrim(item->>'email'),'');
    incoming_source:=coalesce(nullif(item->>'source',''),'manual');
    normalized_nif:=nullif(regexp_replace(coalesce(item->>'nif',''),'[^0-9]','','g'),'');
    IF incoming_name='' OR incoming_source NOT IN ('legacy','manual','mj','crc_lookup')
      OR (normalized_nif IS NOT NULL AND normalized_nif !~ '^[0-9]{9}$') THEN
      RAISE EXCEPTION 'Interveniente inválido.' USING ERRCODE='22023';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(item->'roles') r(value)
      WHERE value NOT IN ('decision_maker','legal_manager')) THEN
      RAISE EXCEPTION 'Função de interveniente inválida.' USING ERRCODE='22023';
    END IF;
    IF item?'role_sources' AND (jsonb_typeof(item->'role_sources')<>'object'
      OR EXISTS(SELECT 1 FROM jsonb_each_text(item->'role_sources') role_source
        WHERE role_source.key NOT IN ('decision_maker','legal_manager')
          OR role_source.value NOT IN ('legacy','manual','mj','crc_lookup'))) THEN
      RAISE EXCEPTION 'Origem de função inválida.' USING ERRCODE='22023';
    END IF;
    pid:=NULL; existing:=NULL;
    IF nullif(item->>'id','') IS NOT NULL THEN
      SELECT * INTO existing FROM public.client_people WHERE id=(item->>'id')::uuid AND client_id=c.id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Interveniente indisponível.' USING ERRCODE='42501'; END IF;
      pid:=existing.id;
    ELSIF normalized_nif IS NOT NULL THEN
      SELECT * INTO existing FROM public.client_people WHERE client_id=c.id AND nif=normalized_nif FOR UPDATE;
      IF FOUND THEN pid:=existing.id; END IF;
    END IF;
    IF pid IS NOT NULL AND (
      ((item?'source_ref') AND nullif(item->>'source_ref','') IS DISTINCT FROM existing.source_ref)
      OR ((item?'source_metadata')
        AND ((item->'source_metadata')-('role'::text)) IS DISTINCT FROM (existing.source_metadata-('role'::text)))
    ) THEN
      RAISE EXCEPTION 'A proveniência do interveniente é imutável.' USING ERRCODE='22023';
    END IF;
    unchanged_legacy:=p_allow_unchanged_legacy AND pid IS NOT NULL AND existing.source='legacy'
      AND incoming_name=btrim(regexp_replace(existing.name,'[[:space:]]+',' ','g'))
      AND normalized_nif IS NOT DISTINCT FROM existing.nif
      AND coalesce(incoming_phone,'')=coalesce(existing.phone,'')
      AND coalesce(incoming_email,'')=coalesce(existing.email,'')
      AND incoming_source=existing.source
      AND (NOT (item?'source_metadata')
        OR coalesce(item->'source_metadata','{}'::jsonb)=coalesce(existing.source_metadata,'{}'::jsonb))
      AND NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements_text(item->'roles') wanted(value)
        WHERE NOT EXISTS(SELECT 1 FROM public.client_person_roles current_assignment
          WHERE current_assignment.person_id=pid AND current_assignment.role=wanted.value)
      )
      AND NOT EXISTS(
        SELECT 1 FROM public.client_person_roles current_assignment
        WHERE current_assignment.person_id=pid AND current_assignment.role IN ('decision_maker','legal_manager')
          AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(item->'roles') wanted(value)
            WHERE wanted.value=current_assignment.role)
      );
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(item->'roles') r(value) WHERE value='decision_maker')
      AND NOT unchanged_legacy
      AND (incoming_phone IS NULL OR incoming_email IS NULL
        OR incoming_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN
      RAISE EXCEPTION 'O decisor deve ter nome, telefone e email completos.' USING ERRCODE='22023';
    END IF;
    IF pid IS NULL THEN
      INSERT INTO public.client_people(organization_id,client_id,name,nif,phone,email,source,source_ref,source_metadata,created_by)
      VALUES(c.organization_id,c.id,incoming_name,normalized_nif,incoming_phone,incoming_email,incoming_source,
        nullif(item->>'source_ref',''),coalesce(item->'source_metadata','{}'::jsonb),auth.uid()) RETURNING id INTO pid;
    ELSE
      UPDATE public.client_people SET name=incoming_name,
        nif=coalesce(normalized_nif,nif),phone=coalesce(incoming_phone,phone),email=coalesce(incoming_email,email),
        source_metadata=CASE WHEN coalesce(item->'source_metadata','{}'::jsonb)?'role'
          THEN jsonb_set(source_metadata,'{role}',item->'source_metadata'->'role',true) ELSE source_metadata END
      WHERE id=pid RETURNING * INTO existing;
    END IF;
    FOR role_name IN SELECT value FROM jsonb_array_elements_text(item->'roles') LOOP
      incoming_role_source:=coalesce(item->'role_sources'->>role_name,incoming_source);
      INSERT INTO public.client_person_roles(person_id,client_id,organization_id,role,source)
      VALUES(pid,c.id,c.organization_id,role_name,incoming_role_source)
      ON CONFLICT(person_id,role) DO NOTHING;
      desired:=desired||jsonb_build_array(jsonb_build_object('person_id',pid,'role',role_name));
    END LOOP;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(desired) assignment WHERE assignment->>'role'='decision_maker') THEN
    RAISE EXCEPTION 'É obrigatório indicar pelo menos um decisor.' USING ERRCODE='22023';
  END IF;
  DELETE FROM public.client_person_roles r WHERE r.client_id=c.id AND r.role IN ('decision_maker','legal_manager')
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(desired) d
      WHERE d->>'person_id'=r.person_id::text AND d->>'role'=r.role);
  SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.name,'nif',coalesce(p.nif,''),'phone',coalesce(p.phone,''),
    'email',coalesce(p.email,''),'role','Decisor') ORDER BY r.created_at,p.id),'[]'::jsonb),min(p.name)
  INTO mirrored,first_name FROM public.client_people p JOIN public.client_person_roles r ON r.person_id=p.id
  WHERE r.client_id=c.id AND r.role='decision_maker';
  UPDATE public.crm_clients SET decision_makers=mirrored,decision_maker_name=first_name,updated_at=clock_timestamp() WHERE id=c.id;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at,v.person_id)
    FROM public.client_people_roles v WHERE v.client_id=c.id),'[]'::jsonb);
END;
$$;

CREATE FUNCTION public.edp_apply_client_patch(p_client_id uuid,p_patch jsonb)
RETURNS public.crm_clients LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.crm_clients; invalid_key text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Alterações inválidas.' USING ERRCODE='22023'; END IF;
  SELECT key INTO invalid_key FROM jsonb_object_keys(p_patch) key
  WHERE key NOT IN ('name','email','phone','company','nif','company_nif','status','source','notes','assigned_to',
    'address_line1','address_line2','city','postal_code','country','distrito','conselho','grupo_economico','billing_target',
    'lead_id','crc_code','certificate_data','certificate_checked_at') LIMIT 1;
  IF invalid_key IS NOT NULL THEN RAISE EXCEPTION 'Campo de cliente não permitido: %',invalid_key USING ERRCODE='22023'; END IF;
  UPDATE public.crm_clients SET
    name=CASE WHEN p_patch?'name' THEN btrim(p_patch->>'name') ELSE name END,
    email=CASE WHEN p_patch?'email' THEN nullif(btrim(p_patch->>'email'),'') ELSE email END,
    phone=CASE WHEN p_patch?'phone' THEN nullif(btrim(p_patch->>'phone'),'') ELSE phone END,
    company=CASE WHEN p_patch?'company' THEN nullif(btrim(p_patch->>'company'),'') ELSE company END,
    nif=CASE WHEN p_patch?'nif' THEN nullif(regexp_replace(p_patch->>'nif','[^0-9]','','g'),'') ELSE nif END,
    company_nif=CASE WHEN p_patch?'company_nif' THEN nullif(regexp_replace(p_patch->>'company_nif','[^0-9]','','g'),'') ELSE company_nif END,
    status=CASE WHEN p_patch?'status' THEN p_patch->>'status' ELSE status END,
    source=CASE WHEN p_patch?'source' THEN p_patch->>'source' ELSE source END,
    notes=CASE WHEN p_patch?'notes' THEN nullif(p_patch->>'notes','') ELSE notes END,
    lead_id=CASE WHEN p_patch?'lead_id' THEN (p_patch->>'lead_id')::uuid ELSE lead_id END,
    assigned_to=CASE WHEN p_patch?'assigned_to' THEN (p_patch->>'assigned_to')::uuid ELSE assigned_to END,
    address_line1=CASE WHEN p_patch?'address_line1' THEN nullif(p_patch->>'address_line1','') ELSE address_line1 END,
    address_line2=CASE WHEN p_patch?'address_line2' THEN nullif(p_patch->>'address_line2','') ELSE address_line2 END,
    city=CASE WHEN p_patch?'city' THEN nullif(p_patch->>'city','') ELSE city END,
    postal_code=CASE WHEN p_patch?'postal_code' THEN nullif(p_patch->>'postal_code','') ELSE postal_code END,
    country=CASE WHEN p_patch?'country' THEN nullif(p_patch->>'country','') ELSE country END,
    distrito=CASE WHEN p_patch?'distrito' THEN nullif(p_patch->>'distrito','') ELSE distrito END,
    conselho=CASE WHEN p_patch?'conselho' THEN nullif(p_patch->>'conselho','') ELSE conselho END,
    grupo_economico=CASE WHEN p_patch?'grupo_economico' THEN nullif(p_patch->>'grupo_economico','') ELSE grupo_economico END,
    billing_target=CASE WHEN p_patch?'billing_target' THEN coalesce(nullif(p_patch->>'billing_target',''),billing_target) ELSE billing_target END,
    updated_at=clock_timestamp()
  WHERE id=p_client_id RETURNING * INTO c;
  IF NOT FOUND OR nullif(btrim(c.name),'') IS NULL THEN RAISE EXCEPTION 'Cliente inválido.' USING ERRCODE='22023'; END IF;
  RETURN c;
END;
$$;

CREATE FUNCTION public.save_client_people_roles(p_client_id uuid,p_expected_updated_at timestamptz,p_client_patch jsonb DEFAULT '{}'::jsonb,p_people jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.crm_clients; people jsonb; current_certificate uuid; requested_data jsonb;
BEGIN
  SELECT * INTO c FROM public.crm_clients WHERE id=p_client_id FOR UPDATE;
  IF NOT FOUND OR c.organization_id<>public.get_user_org_id(auth.uid()) OR NOT public.app_can_view_client(c.id) THEN
    RAISE EXCEPTION 'Cliente indisponível.' USING ERRCODE='42501';
  END IF;
  IF public.has_module_permission(c.organization_id,'clients','list','edit') IS NOT TRUE THEN
    RAISE EXCEPTION 'Sem permissão para editar clientes.' USING ERRCODE='42501';
  END IF;
  IF c.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'client_revision_conflict' USING ERRCODE='40001';
  END IF;
  IF p_client_patch?'certificate_data' AND p_client_patch->'certificate_data'<>'null'::jsonb
    AND jsonb_typeof(p_client_patch->'certificate_data')<>'object' THEN
    RAISE EXCEPTION 'Certidão inválida.' USING ERRCODE='22023';
  END IF;
  IF nullif(btrim(coalesce(p_client_patch->>'crc_code','')),'') IS NOT NULL
    OR coalesce(p_client_patch->'certificate_data','null'::jsonb) NOT IN ('null'::jsonb,'{}'::jsonb)
    OR nullif(p_client_patch->>'certificate_checked_at','') IS NOT NULL THEN
    requested_data:=CASE WHEN p_client_patch->'certificate_data' IS NULL OR p_client_patch->'certificate_data'='null'::jsonb
      THEN '{}'::jsonb ELSE p_client_patch->'certificate_data' END;
    IF jsonb_typeof(requested_data)<>'object' THEN RAISE EXCEPTION 'Certidão inválida.' USING ERRCODE='22023'; END IF;
    SELECT id INTO current_certificate FROM public.client_certificate_versions WHERE client_id=c.id AND superseded_at IS NULL;
    IF current_certificate IS NOT NULL OR c.crc_code IS NOT NULL OR c.certificate_data IS NOT NULL THEN
      IF c.crc_code IS DISTINCT FROM nullif(p_client_patch->>'crc_code','')
        OR coalesce(c.certificate_data,'{}'::jsonb) IS DISTINCT FROM requested_data THEN
        RAISE EXCEPTION 'certificate_renewal_required' USING ERRCODE='55000';
      END IF;
    ELSE
      PERFORM public.renew_client_certificate(c.id,NULL,nullif(p_client_patch->>'crc_code',''),requested_data,NULL,NULL,'manual',
        jsonb_strip_nulls(jsonb_build_object('certificate_checked_at',nullif(p_client_patch->>'certificate_checked_at',''))));
    END IF;
  END IF;
  c:=public.edp_apply_client_patch(c.id,p_client_patch);
  people:=public.edp_replace_client_people(c.id,p_people,true);
  SELECT * INTO c FROM public.crm_clients WHERE id=c.id;
  RETURN jsonb_build_object('client',to_jsonb(c),'people',people);
END;
$$;

CREATE FUNCTION public.create_client_with_people(p_client_patch jsonb,p_people jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE org uuid; c public.crm_clients; people jsonb; invalid_key text; requested_data jsonb; certificate_recorded_at timestamptz;
BEGIN
  org:=public.get_user_org_id(auth.uid());
  IF auth.uid() IS NULL OR org IS NULL OR jsonb_typeof(p_client_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Sessão autorizada necessária.' USING ERRCODE='42501';
  END IF;
  IF public.has_module_permission(org,'clients','list','add') IS NOT TRUE THEN
    RAISE EXCEPTION 'Sem permissão para criar clientes.' USING ERRCODE='42501';
  END IF;
  SELECT key INTO invalid_key FROM jsonb_object_keys(p_client_patch) key
  WHERE key NOT IN ('name','email','phone','company','nif','company_nif','status','source','notes','assigned_to',
    'address_line1','address_line2','city','postal_code','country','distrito','conselho','grupo_economico','billing_target',
    'lead_id','crc_code','certificate_data','certificate_checked_at') LIMIT 1;
  IF invalid_key IS NOT NULL OR nullif(btrim(p_client_patch->>'name'),'') IS NULL THEN
    RAISE EXCEPTION 'Cliente inválido.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.crm_clients(organization_id,lead_id,name,email,phone,company,nif,company_nif,status,source,notes,assigned_to,
    address_line1,address_line2,city,postal_code,country,distrito,conselho,grupo_economico,billing_target,created_by)
  VALUES(org,nullif(p_client_patch->>'lead_id','')::uuid,btrim(p_client_patch->>'name'),nullif(btrim(p_client_patch->>'email'),''),nullif(btrim(p_client_patch->>'phone'),''),
    nullif(btrim(p_client_patch->>'company'),''),nullif(regexp_replace(p_client_patch->>'nif','[^0-9]','','g'),''),
    nullif(regexp_replace(p_client_patch->>'company_nif','[^0-9]','','g'),''),coalesce(nullif(p_client_patch->>'status',''),'active'),
    coalesce(nullif(p_client_patch->>'source',''),'direct'),nullif(p_client_patch->>'notes',''),
    coalesce((p_client_patch->>'assigned_to')::uuid,auth.uid()),nullif(p_client_patch->>'address_line1',''),
    nullif(p_client_patch->>'address_line2',''),nullif(p_client_patch->>'city',''),nullif(p_client_patch->>'postal_code',''),
    nullif(p_client_patch->>'country',''),nullif(p_client_patch->>'distrito',''),nullif(p_client_patch->>'conselho',''),
    nullif(p_client_patch->>'grupo_economico',''),coalesce(nullif(p_client_patch->>'billing_target',''),'client'),auth.uid()) RETURNING * INTO c;
  IF p_client_patch?'certificate_data' AND p_client_patch->'certificate_data'<>'null'::jsonb
    AND jsonb_typeof(p_client_patch->'certificate_data')<>'object' THEN
    RAISE EXCEPTION 'Certidão inválida.' USING ERRCODE='22023';
  END IF;
  IF nullif(btrim(coalesce(p_client_patch->>'crc_code','')),'') IS NOT NULL
    OR coalesce(p_client_patch->'certificate_data','null'::jsonb) NOT IN ('null'::jsonb,'{}'::jsonb)
    OR nullif(p_client_patch->>'certificate_checked_at','') IS NOT NULL THEN
    requested_data:=CASE WHEN p_client_patch->'certificate_data' IS NULL OR p_client_patch->'certificate_data'='null'::jsonb
      THEN '{}'::jsonb ELSE p_client_patch->'certificate_data' END;
    IF jsonb_typeof(requested_data)<>'object' THEN RAISE EXCEPTION 'Certidão inválida.' USING ERRCODE='22023'; END IF;
    IF nullif(p_client_patch->>'crc_code','') IS NOT NULL
      AND p_client_patch->>'crc_code'!~'^[0-9]{4}-[0-9]{4}-[0-9]{4}$' THEN
      RAISE EXCEPTION 'Certidão inválida.' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.client_certificate_versions(organization_id,client_id,crc_code,certificate_data,source,source_metadata,recorded_by)
    VALUES(c.organization_id,c.id,nullif(p_client_patch->>'crc_code',''),requested_data,'manual',
      jsonb_strip_nulls(jsonb_build_object('certificate_checked_at',nullif(p_client_patch->>'certificate_checked_at',''))),auth.uid())
    RETURNING recorded_at INTO certificate_recorded_at;
    UPDATE public.crm_clients SET crc_code=nullif(p_client_patch->>'crc_code',''),certificate_data=requested_data,
      certificate_checked_at=certificate_recorded_at WHERE id=c.id;
  END IF;
  people:=public.edp_replace_client_people(c.id,p_people,false);
  SELECT * INTO c FROM public.crm_clients WHERE id=c.id;
  RETURN jsonb_build_object('client',to_jsonb(c),'people',people);
END;
$$;

REVOKE ALL ON FUNCTION public.edp_replace_client_people(uuid,jsonb,boolean),public.edp_apply_client_patch(uuid,jsonb),
  public.save_client_people_roles(uuid,timestamptz,jsonb,jsonb),public.create_client_with_people(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_client_people_roles(uuid,timestamptz,jsonb,jsonb),public.create_client_with_people(jsonb,jsonb) TO authenticated;

CREATE TABLE public.client_certificate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
  crc_code text CHECK(crc_code IS NULL OR crc_code~'^[0-9]{4}-[0-9]{4}-[0-9]{4}$'),
  certificate_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(certificate_data)='object'),
  valid_from date,valid_until date,source text NOT NULL CHECK(source IN ('legacy','manual','crc_lookup')),
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_metadata)='object'),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  superseded_at timestamptz, CHECK(valid_until IS NULL OR valid_from IS NULL OR valid_until>=valid_from)
);
CREATE UNIQUE INDEX client_certificate_current_unique ON public.client_certificate_versions(client_id) WHERE superseded_at IS NULL;
CREATE INDEX client_certificate_history_idx ON public.client_certificate_versions(client_id,recorded_at DESC,id DESC);
ALTER TABLE public.client_certificate_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_certificate_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.client_certificate_versions TO authenticated;
GRANT ALL ON public.client_certificate_versions TO service_role;
CREATE POLICY client_certificate_versions_select ON public.client_certificate_versions FOR SELECT TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));

INSERT INTO public.client_certificate_versions(organization_id,client_id,crc_code,certificate_data,source,source_metadata,recorded_by,recorded_at)
SELECT organization_id,id,CASE WHEN crc_code~'^[0-9]{4}-[0-9]{4}-[0-9]{4}$' THEN crc_code END,
  CASE WHEN jsonb_typeof(certificate_data)='object' THEN certificate_data ELSE '{}'::jsonb END,'legacy',
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_crc_code',CASE WHEN crc_code IS NOT NULL AND crc_code!~'^[0-9]{4}-[0-9]{4}-[0-9]{4}$' THEN crc_code END,
    'legacy_certificate_data',CASE WHEN certificate_data IS NOT NULL AND jsonb_typeof(certificate_data)<>'object' THEN certificate_data END)),
  CASE WHEN EXISTS(SELECT 1 FROM auth.users user_row WHERE user_row.id=crm_clients.created_by) THEN created_by END,
  coalesce(certificate_checked_at,created_at,now())
FROM public.crm_clients WHERE crc_code IS NOT NULL OR certificate_data IS NOT NULL;

CREATE VIEW public.client_certificate_history WITH(security_invoker=true) AS
SELECT id AS version_id,id,organization_id,client_id,crc_code,certificate_data,valid_from,valid_until,source,source_metadata,
  recorded_by,recorded_at,(superseded_at IS NULL) AS is_current
FROM public.client_certificate_versions;
GRANT SELECT ON public.client_certificate_history TO authenticated,service_role;

CREATE FUNCTION public.renew_client_certificate(p_client_id uuid,p_expected_current_version_id uuid DEFAULT NULL,p_crc_code text DEFAULT NULL,
  p_certificate_data jsonb DEFAULT '{}'::jsonb,p_valid_from date DEFAULT NULL,p_valid_until date DEFAULT NULL,
  p_source text DEFAULT 'manual',p_source_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS public.client_certificate_versions LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.crm_clients; current_id uuid; result public.client_certificate_versions;
BEGIN
  IF auth.uid() IS NULL OR p_source NOT IN ('legacy','manual','crc_lookup') OR jsonb_typeof(p_certificate_data)<>'object'
    OR jsonb_typeof(p_source_metadata)<>'object' OR (p_crc_code IS NOT NULL AND p_crc_code!~'^[0-9]{4}-[0-9]{4}-[0-9]{4}$')
    OR (p_valid_from IS NOT NULL AND p_valid_until IS NOT NULL AND p_valid_until<p_valid_from) THEN
    RAISE EXCEPTION 'Certidão inválida.' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_id::text,0));
  SELECT * INTO c FROM public.crm_clients WHERE id=p_client_id FOR UPDATE;
  IF NOT FOUND OR c.organization_id<>public.get_user_org_id(auth.uid()) OR NOT public.app_can_view_client(c.id) THEN
    RAISE EXCEPTION 'Cliente indisponível.' USING ERRCODE='42501';
  END IF;
  IF public.has_module_permission(c.organization_id,'clients','list','edit') IS NOT TRUE THEN
    RAISE EXCEPTION 'Sem permissão para editar clientes.' USING ERRCODE='42501';
  END IF;
  SELECT id INTO current_id FROM public.client_certificate_versions WHERE client_id=c.id AND superseded_at IS NULL FOR UPDATE;
  IF current_id IS DISTINCT FROM p_expected_current_version_id THEN RAISE EXCEPTION 'certificate_revision_conflict' USING ERRCODE='40001'; END IF;
  UPDATE public.client_certificate_versions SET superseded_at=clock_timestamp() WHERE id=current_id;
  INSERT INTO public.client_certificate_versions(organization_id,client_id,crc_code,certificate_data,valid_from,valid_until,source,source_metadata,recorded_by)
  VALUES(c.organization_id,c.id,p_crc_code,p_certificate_data,p_valid_from,p_valid_until,p_source,p_source_metadata,auth.uid()) RETURNING * INTO result;
  UPDATE public.crm_clients SET crc_code=p_crc_code,certificate_data=p_certificate_data,certificate_checked_at=result.recorded_at WHERE id=c.id;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.renew_client_certificate(uuid,uuid,text,jsonb,date,date,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renew_client_certificate(uuid,uuid,text,jsonb,date,date,text,jsonb) TO authenticated;

CREATE FUNCTION public.edp_guard_client_certificate_projection()
RETURNS trigger LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.client_certificate_versions version
    WHERE version.client_id=NEW.id AND version.superseded_at IS NULL
      AND version.crc_code IS NOT DISTINCT FROM NEW.crc_code
      AND version.certificate_data IS NOT DISTINCT FROM coalesce(NEW.certificate_data,'{}'::jsonb)
      AND version.recorded_at IS NOT DISTINCT FROM NEW.certificate_checked_at
  ) THEN
    RAISE EXCEPTION 'certificate_renewal_required' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER crm_clients_certificate_projection_guard
BEFORE UPDATE OF crc_code,certificate_data,certificate_checked_at ON public.crm_clients
FOR EACH ROW WHEN(
  NEW.crc_code IS DISTINCT FROM OLD.crc_code OR NEW.certificate_data IS DISTINCT FROM OLD.certificate_data
  OR NEW.certificate_checked_at IS DISTINCT FROM OLD.certificate_checked_at
) EXECUTE FUNCTION public.edp_guard_client_certificate_projection();
CREATE TRIGGER crm_clients_certificate_projection_insert_guard
BEFORE INSERT ON public.crm_clients
FOR EACH ROW WHEN(NEW.crc_code IS NOT NULL OR NEW.certificate_data IS NOT NULL OR NEW.certificate_checked_at IS NOT NULL)
EXECUTE FUNCTION public.edp_guard_client_certificate_projection();
REVOKE ALL ON FUNCTION public.edp_guard_client_certificate_projection() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,person_id uuid REFERENCES public.client_people(id) ON DELETE SET NULL,
  category text NOT NULL CHECK(btrim(category)<>''),label text NOT NULL CHECK(btrim(label)<>''),archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,client_id,organization_id)
);
CREATE TABLE public.client_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL,organization_id uuid NOT NULL,client_id uuid NOT NULL,
  side text NOT NULL CHECK(side IN ('single','front','back')),bucket_id text NOT NULL DEFAULT 'edp-client-documents' CHECK(bucket_id='edp-client-documents'),
  storage_path text NOT NULL UNIQUE CHECK(storage_path!~'(^|/)[.][.]($|/)'),original_name text NOT NULL,mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=10485760),sha256 text NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),
  validity_suggested_on date,validity_confirmed_on date,validity_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_document_versions_document_scope_fkey FOREIGN KEY(document_id,client_id,organization_id)
    REFERENCES public.client_documents(id,client_id,organization_id) ON DELETE RESTRICT
);
CREATE INDEX client_documents_client_idx ON public.client_documents(client_id,archived_at,created_at);
CREATE INDEX client_document_versions_client_idx ON public.client_document_versions(client_id,created_at DESC);
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY; ALTER TABLE public.client_document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_documents,public.client_document_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.client_documents,public.client_document_versions TO authenticated;
GRANT ALL ON public.client_documents,public.client_document_versions TO service_role;
CREATE POLICY client_documents_select ON public.client_documents FOR SELECT TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));
CREATE POLICY client_document_versions_select ON public.client_document_versions FOR SELECT TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_client(client_id));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('edp-client-documents','edp-client-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
CREATE POLICY edp_documents_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon
USING(bucket_id<>'edp-client-documents') WITH CHECK(bucket_id<>'edp-client-documents');
CREATE POLICY edp_documents_select_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(
  bucket_id<>'edp-client-documents' OR EXISTS(SELECT 1 FROM public.client_document_versions v
    WHERE v.bucket_id=storage.objects.bucket_id AND v.storage_path=storage.objects.name
      AND v.organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_client(v.client_id)));
CREATE POLICY edp_documents_read ON storage.objects FOR SELECT TO authenticated USING(
  bucket_id='edp-client-documents' AND EXISTS(SELECT 1 FROM public.client_document_versions v
    WHERE v.bucket_id=storage.objects.bucket_id AND v.storage_path=storage.objects.name
      AND v.organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_client(v.client_id)));
CREATE POLICY edp_documents_write_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(bucket_id<>'edp-client-documents');
CREATE POLICY edp_documents_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING(bucket_id<>'edp-client-documents') WITH CHECK(bucket_id<>'edp-client-documents');
CREATE POLICY edp_documents_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING(bucket_id<>'edp-client-documents');

CREATE FUNCTION public.edp_is_workflow_actor(p_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_role(auth.uid(),'super_admin'::public.app_role)
    OR EXISTS(
      SELECT 1 FROM public.organization_members member
      LEFT JOIN public.organization_profiles profile ON profile.id=member.profile_id AND profile.organization_id=member.organization_id
      WHERE member.user_id=auth.uid() AND member.organization_id=p_organization_id AND member.is_active
        AND (profile.name='Back Office' OR profile.base_role::text IN ('admin','salesperson')
          OR (member.profile_id IS NULL AND member.role::text IN ('admin','salesperson')))
    ),false)
$$;
REVOKE ALL ON FUNCTION public.edp_is_workflow_actor(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.edp_archive_document(p_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.client_documents;
BEGIN
  SELECT * INTO d FROM public.client_documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND OR d.organization_id<>public.get_user_org_id(auth.uid()) OR NOT public.app_can_view_client(d.client_id) THEN
    RAISE EXCEPTION 'Documento indisponível.' USING ERRCODE='42501';
  END IF;
  PERFORM public.edp_assert_client_document_write(d.client_id);
  UPDATE public.client_documents SET archived_at=coalesce(archived_at,clock_timestamp()),updated_at=clock_timestamp() WHERE id=d.id RETURNING * INTO d;
  RETURN jsonb_build_object('document_id',d.id,'archived_at',d.archived_at);
END;
$$;
REVOKE ALL ON FUNCTION public.edp_archive_document(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edp_archive_document(uuid) TO authenticated;

CREATE FUNCTION public.edp_assert_client_document_write(p_client_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.crm_clients;
BEGIN
  SELECT * INTO c FROM public.crm_clients WHERE id=p_client_id;
  IF auth.uid() IS NULL OR NOT FOUND OR c.organization_id<>public.get_user_org_id(auth.uid())
    OR NOT public.app_can_view_client(c.id) OR NOT public.edp_is_workflow_actor(c.organization_id) THEN
    RAISE EXCEPTION 'Sem permissão para editar documentos do cliente.' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.edp_assert_client_document_write(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edp_assert_client_document_write(uuid) TO authenticated;

CREATE FUNCTION public.edp_register_document_version(p_document_id uuid,p_version_id uuid,p_user_id uuid,p_organization_id uuid,
  p_client_id uuid,p_person_id uuid,p_category text,p_label text,p_side text,p_storage_path text,p_original_name text,
  p_mime_type text,p_size_bytes bigint,p_sha256 text,p_validity_suggested_on date DEFAULT NULL,p_validity_confirmed_on date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE d public.client_documents; v public.client_document_versions;
BEGIN
  IF p_person_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.client_people p WHERE p.id=p_person_id AND p.client_id=p_client_id AND p.organization_id=p_organization_id) THEN
    RAISE EXCEPTION 'Interveniente inválido.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO d FROM public.client_documents WHERE id=p_document_id FOR UPDATE;
  IF FOUND THEN
    IF d.organization_id<>p_organization_id OR d.client_id<>p_client_id THEN RAISE EXCEPTION 'Documento inválido.' USING ERRCODE='22023'; END IF;
  ELSE
    INSERT INTO public.client_documents(id,organization_id,client_id,person_id,category,label,created_by)
    VALUES(p_document_id,p_organization_id,p_client_id,p_person_id,p_category,p_label,p_user_id) RETURNING * INTO d;
  END IF;
  INSERT INTO public.client_document_versions(id,document_id,organization_id,client_id,side,storage_path,original_name,mime_type,size_bytes,sha256,
    validity_suggested_on,validity_confirmed_on,validity_confirmed_by,created_by)
  VALUES(p_version_id,d.id,p_organization_id,p_client_id,p_side,p_storage_path,p_original_name,p_mime_type,p_size_bytes,p_sha256,
    p_validity_suggested_on,p_validity_confirmed_on,CASE WHEN p_validity_confirmed_on IS NULL THEN NULL ELSE p_user_id END,p_user_id) RETURNING * INTO v;
  RETURN jsonb_build_object('document_id',d.id,'version_id',v.id,'person_id',d.person_id,'category',d.category,'label',d.label,
    'side',v.side,'original_name',v.original_name,'mime_type',v.mime_type,'size_bytes',v.size_bytes,'sha256',v.sha256,
    'validity_suggested_on',v.validity_suggested_on,'validity_confirmed_on',v.validity_confirmed_on,'created_at',v.created_at);
END;
$$;
REVOKE ALL ON FUNCTION public.edp_register_document_version(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,bigint,text,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edp_register_document_version(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,bigint,text,date,date) TO service_role;

CREATE TABLE public.edp_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),subject_template text NOT NULL,body_template text NOT NULL,
  recipients jsonb NOT NULL CHECK(jsonb_typeof(recipients)='array'),cc_recipients jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(cc_recipients)='array'),
  sender_name text NOT NULL,sender_email text NOT NULL,send_enabled boolean NOT NULL DEFAULT false,
  transport text NOT NULL DEFAULT 'local_capture' CHECK(transport IN ('local_capture','brevo')),
  officially_confirmed boolean NOT NULL DEFAULT false CHECK(NOT officially_confirmed),
  configured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.edp_checklist_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  energy_type text NOT NULL CHECK(energy_type IN ('ee','gn','ee_gn')),category text NOT NULL CHECK(btrim(category)<>''),
  label text NOT NULL CHECK(btrim(label)<>''),required boolean NOT NULL DEFAULT false,position integer NOT NULL DEFAULT 0 CHECK(position>=0),
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX edp_checklist_rules_org_idx ON public.edp_checklist_rules(organization_id,energy_type,position,id);
ALTER TABLE public.edp_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.edp_checklist_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edp_settings,public.edp_checklist_rules FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.edp_settings,public.edp_checklist_rules TO authenticated;
GRANT ALL ON public.edp_settings,public.edp_checklist_rules TO service_role;
CREATE POLICY edp_settings_select ON public.edp_settings FOR SELECT TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()));
CREATE POLICY edp_settings_insert ON public.edp_settings FOR INSERT TO authenticated
WITH CHECK(organization_id=public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid(),organization_id));
CREATE POLICY edp_settings_update ON public.edp_settings FOR UPDATE TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid(),organization_id))
WITH CHECK(organization_id=public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid(),organization_id));
CREATE POLICY edp_settings_delete ON public.edp_settings FOR DELETE TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid(),organization_id));
CREATE POLICY edp_checklist_select ON public.edp_checklist_rules FOR SELECT TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()));
CREATE POLICY edp_checklist_insert ON public.edp_checklist_rules FOR INSERT TO authenticated
WITH CHECK(organization_id=public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid(),organization_id));
CREATE POLICY edp_checklist_update ON public.edp_checklist_rules FOR UPDATE TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid(),organization_id))
WITH CHECK(organization_id=public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid(),organization_id));
CREATE POLICY edp_checklist_delete ON public.edp_checklist_rules FOR DELETE TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.is_org_admin(auth.uid(),organization_id));

CREATE FUNCTION public.edp_get_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE org uuid; s public.edp_settings; checklist jsonb;
BEGIN
  org:=public.get_user_org_id(auth.uid());
  IF auth.uid() IS NULL OR org IS NULL THEN RAISE EXCEPTION 'Sessão autorizada necessária.' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.edp_settings WHERE organization_id=org;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'energy_type',energy_type,'category',category,'label',label,
    'required',required,'position',position) ORDER BY energy_type,position,id),'[]'::jsonb)
  INTO checklist FROM public.edp_checklist_rules WHERE organization_id=org;
  RETURN jsonb_build_object('settings',jsonb_build_object(
    'revision',coalesce(s.revision,0),'subject_template',coalesce(s.subject_template,''),'body_template',coalesce(s.body_template,''),
    'to',coalesce(s.recipients,'[]'::jsonb),'cc',coalesce(s.cc_recipients,'[]'::jsonb),'sender_name',coalesce(s.sender_name,''),
    'sender_email',coalesce(s.sender_email,'local@example.test'),'send_enabled',coalesce(s.send_enabled,false),
    'transport',coalesce(s.transport,'local_capture'),'officially_confirmed',false,'configured',s.organization_id IS NOT NULL),
    'checklist',checklist);
END;
$$;

CREATE FUNCTION public.edp_normalize_template(p_template text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(p_template,
    '{{[[:space:]]*client_name[[:space:]]*}}','{{client_name}}','g'),
    '{{[[:space:]]*client_nif[[:space:]]*}}','{{client_nif}}','g'),
    '{{[[:space:]]*proposal_number[[:space:]]*}}','{{proposal_number}}','g'),
    '{{[[:space:]]*energy_type[[:space:]]*}}','{{energy_type}}','g'),
    '{{[[:space:]]*billing_email[[:space:]]*}}','{{billing_email}}','g')
$$;
REVOKE ALL ON FUNCTION public.edp_normalize_template(text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.edp_save_settings(p_expected_revision integer,p_settings jsonb,p_checklist jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; current_revision integer; entry jsonb; value text; placeholder text;
BEGIN
  org:=public.get_user_org_id(auth.uid());
  IF auth.uid() IS NULL OR org IS NULL OR NOT public.is_org_admin(auth.uid(),org) THEN
    RAISE EXCEPTION 'Apenas um administrador pode configurar o EDP.' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_settings)<>'object' OR jsonb_typeof(p_checklist)<>'array'
    OR nullif(btrim(p_settings->>'subject_template'),'') IS NULL OR nullif(btrim(p_settings->>'body_template'),'') IS NULL
    OR jsonb_typeof(p_settings->'to')<>'array' OR jsonb_array_length(p_settings->'to')=0
    OR jsonb_typeof(coalesce(p_settings->'cc','[]'::jsonb))<>'array'
    OR jsonb_typeof(coalesce(p_settings->'send_enabled','false'::jsonb))<>'boolean'
    OR coalesce(p_settings->>'transport','local_capture') NOT IN ('local_capture','brevo')
    OR nullif(btrim(p_settings->>'sender_name'),'') IS NULL
    OR coalesce(p_settings->>'sender_email','')!~*'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Configuração EDP inválida.' USING ERRCODE='22023';
  END IF;
  FOR value IN SELECT jsonb_array_elements_text((p_settings->'to')||coalesce(p_settings->'cc','[]'::jsonb)) LOOP
    IF value!~*'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Destinatário EDP inválido.' USING ERRCODE='22023'; END IF;
  END LOOP;
  FOR placeholder IN SELECT btrim(captures[1]) FROM regexp_matches(
    (p_settings->>'subject_template')||' '||(p_settings->>'body_template'),'{{([^{}]*)}}','g') captures LOOP
    IF placeholder NOT IN ('client_name','client_nif','proposal_number','energy_type','billing_email') THEN
      RAISE EXCEPTION 'Variável EDP desconhecida: %',placeholder USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF regexp_replace((p_settings->>'subject_template')||' '||(p_settings->>'body_template'),'{{[^{}]*}}','','g')~'{{|}}' THEN
    RAISE EXCEPTION 'Template EDP inválido.' USING ERRCODE='22023';
  END IF;
  SELECT revision INTO current_revision FROM public.edp_settings WHERE organization_id=org FOR UPDATE;
  IF coalesce(current_revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'edp_settings_revision_conflict' USING ERRCODE='40001'; END IF;
  INSERT INTO public.edp_settings(organization_id,revision,subject_template,body_template,recipients,cc_recipients,sender_name,sender_email,send_enabled,transport,configured_by)
  VALUES(org,p_expected_revision+1,public.edp_normalize_template(p_settings->>'subject_template'),
    public.edp_normalize_template(p_settings->>'body_template'),p_settings->'to',coalesce(p_settings->'cc','[]'::jsonb),
    p_settings->>'sender_name',p_settings->>'sender_email',coalesce((p_settings->>'send_enabled')::boolean,false),coalesce(p_settings->>'transport','local_capture'),auth.uid())
  ON CONFLICT(organization_id) DO UPDATE SET revision=excluded.revision,subject_template=excluded.subject_template,
    body_template=excluded.body_template,recipients=excluded.recipients,cc_recipients=excluded.cc_recipients,
    sender_name=excluded.sender_name,sender_email=excluded.sender_email,send_enabled=excluded.send_enabled,transport=excluded.transport,
    configured_by=auth.uid(),updated_at=clock_timestamp();
  DELETE FROM public.edp_checklist_rules WHERE organization_id=org;
  FOR entry IN SELECT element.value FROM jsonb_array_elements(p_checklist) AS element(value) LOOP
    IF jsonb_typeof(entry)<>'object' OR entry->>'energy_type' NOT IN ('ee','gn','ee_gn')
      OR nullif(btrim(entry->>'category'),'') IS NULL OR nullif(btrim(entry->>'label'),'') IS NULL THEN
      RAISE EXCEPTION 'Regra de checklist inválida.' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.edp_checklist_rules(id,organization_id,energy_type,category,label,required,position)
    VALUES(coalesce((entry->>'id')::uuid,gen_random_uuid()),org,entry->>'energy_type',btrim(entry->>'category'),btrim(entry->>'label'),
      coalesce((entry->>'required')::boolean,false),coalesce((entry->>'position')::integer,0));
  END LOOP;
  RETURN public.edp_get_settings();
END;
$$;
REVOKE ALL ON FUNCTION public.edp_get_settings(),public.edp_save_settings(integer,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edp_get_settings(),public.edp_save_settings(integer,jsonb,jsonb) TO authenticated;

CREATE TABLE public.edp_sale_drafts (
  sale_id uuid PRIMARY KEY REFERENCES public.sales(id) ON DELETE CASCADE,organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,revision integer NOT NULL CHECK(revision>0),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),readiness text NOT NULL CHECK(readiness IN ('draft','ready','blocked')),
  blocking_reasons text[] NOT NULL DEFAULT '{}',updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX edp_sale_drafts_org_idx ON public.edp_sale_drafts(organization_id,updated_at DESC);
ALTER TABLE public.edp_sale_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edp_sale_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.edp_sale_drafts TO authenticated; GRANT ALL ON public.edp_sale_drafts TO service_role;
CREATE POLICY edp_sale_drafts_select ON public.edp_sale_drafts FOR SELECT TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_sale(sale_id) AND public.app_can_view_client(client_id));
CREATE POLICY edp_sale_drafts_insert ON public.edp_sale_drafts FOR INSERT TO authenticated
WITH CHECK(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_sale(sale_id) AND public.app_can_view_client(client_id));
CREATE POLICY edp_sale_drafts_update ON public.edp_sale_drafts FOR UPDATE TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_sale(sale_id) AND public.app_can_view_client(client_id))
WITH CHECK(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_sale(sale_id) AND public.app_can_view_client(client_id));
CREATE POLICY edp_sale_drafts_delete ON public.edp_sale_drafts FOR DELETE TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_sale(sale_id) AND public.app_can_view_client(client_id));

CREATE FUNCTION public.edp_validate_draft_payload(p_payload jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(p_payload)<>'object' OR p_payload->>'energy_type' NOT IN ('ee','gn','ee_gn')
    OR jsonb_typeof(p_payload->'supply_points')<>'array' OR jsonb_typeof(p_payload->'selected_document_version_ids')<>'array'
    OR jsonb_typeof(p_payload->'checklist_confirmations')<>'array' OR p_payload->>'paid_extraction_requested'<>'false'
    OR jsonb_typeof(p_payload->'confirm_client_contact_sync')<>'boolean'
    OR jsonb_typeof(p_payload->'direct_debit') NOT IN ('boolean','null')
    OR jsonb_typeof(p_payload->'electronic_invoice') NOT IN ('boolean','null') THEN
    RAISE EXCEPTION 'Rascunho EDP inválido.' USING ERRCODE='22023';
  END IF;
  IF p_payload->'responsible'<>'null'::jsonb AND (jsonb_typeof(p_payload->'responsible')<>'object'
    OR jsonb_typeof(p_payload->'responsible'->'name')<>'string' OR jsonb_typeof(p_payload->'responsible'->'phone')<>'string'
    OR jsonb_typeof(p_payload->'responsible'->'email')<>'string') THEN
    RAISE EXCEPTION 'Responsável EDP inválido.' USING ERRCODE='22023';
  END IF;
  IF p_payload->>'confirm_client_contact_sync'='true' AND (
    p_payload->'responsible'='null'::jsonb OR nullif(p_payload->>'responsible_person_id','') IS NULL
    OR nullif(btrim(p_payload->'responsible'->>'phone'),'') IS NULL
    OR coalesce(p_payload->'responsible'->>'email','')!~*'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ) THEN
    RAISE EXCEPTION 'Responsável EDP inválido para sincronização.' USING ERRCODE='22023';
  END IF;
  IF p_payload->'billing_email'<>'null'::jsonb AND coalesce(p_payload->>'billing_email','')!~*'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Email de faturação inválido.' USING ERRCODE='22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'supply_points') LOOP
    IF jsonb_typeof(item)<>'object' OR item->>'kind' NOT IN ('cpe','cui') OR nullif(btrim(item->>'code'),'') IS NULL
      OR (item->'contract_start_date'<>'null'::jsonb AND coalesce(item->>'contract_start_date','')!~'^\d{4}-\d{2}-\d{2}$') THEN
      RAISE EXCEPTION 'Ponto de fornecimento inválido.' USING ERRCODE='22023';
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION public.edp_draft_blockers(p_sale_id uuid,p_payload jsonb)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.sales; reasons text[]:='{}'; selected_count integer; available_count integer; cert public.client_certificate_versions;
  responsible_id uuid; responsible public.client_people; required_missing boolean;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id=p_sale_id;
  IF NOT FOUND OR s.client_id IS NULL THEN RETURN ARRAY['sale_client_missing']; END IF;
  IF nullif(btrim(p_payload->>'proposal_number'),'') IS NULL THEN reasons:=array_append(reasons,'proposal_number_missing'); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'supply_points') point WHERE point->'contract_start_date'='null'::jsonb) THEN
    reasons:=array_append(reasons,'contract_start_date_missing'); END IF;
  IF p_payload->'direct_debit'='null'::jsonb THEN reasons:=array_append(reasons,'direct_debit_missing'); END IF;
  IF p_payload->'electronic_invoice'='null'::jsonb THEN reasons:=array_append(reasons,'electronic_invoice_missing'); END IF;
  IF p_payload->>'electronic_invoice'='true' AND p_payload->'billing_email'='null'::jsonb THEN reasons:=array_append(reasons,'billing_email_required'); END IF;
  responsible_id:=nullif(p_payload->>'responsible_person_id','')::uuid;
  SELECT p.* INTO responsible FROM public.client_people p JOIN public.client_person_roles r ON r.person_id=p.id AND r.role='decision_maker'
  WHERE p.id=responsible_id AND p.client_id=s.client_id;
  IF NOT FOUND OR nullif(btrim(responsible.name),'') IS NULL OR nullif(btrim(coalesce(responsible.phone,'')),'') IS NULL
    OR coalesce(responsible.email,'')!~*'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN reasons:=array_append(reasons,'decision_maker_incomplete'); END IF;
  SELECT * INTO cert FROM public.client_certificate_versions WHERE id=nullif(p_payload->>'certificate_version_id','')::uuid
    AND client_id=s.client_id AND superseded_at IS NULL;
  IF NOT FOUND THEN reasons:=array_append(reasons,'certificate_missing');
  ELSIF cert.valid_until IS NULL THEN reasons:=array_append(reasons,'certificate_validity_unknown');
  ELSIF cert.valid_until<current_date THEN reasons:=array_append(reasons,'certificate_expired'); END IF;
  selected_count:=jsonb_array_length(p_payload->'selected_document_version_ids');
  SELECT count(DISTINCT v.id) INTO available_count FROM public.client_document_versions v JOIN public.client_documents d ON d.id=v.document_id
  WHERE v.client_id=s.client_id AND d.archived_at IS NULL
    AND v.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p_payload->'selected_document_version_ids'));
  IF selected_count<>available_count THEN reasons:=array_append(reasons,'selected_document_missing'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.edp_checklist_rules r WHERE r.organization_id=s.organization_id AND r.energy_type=p_payload->>'energy_type' AND r.required
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'checklist_confirmations') c
      WHERE c->>'rule_id'=r.id::text AND c->>'confirmed'='true')) INTO required_missing;
  IF required_missing THEN reasons:=array_append(reasons,'checklist_incomplete'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.edp_settings e WHERE e.organization_id=s.organization_id AND jsonb_array_length(e.recipients)>0) THEN
    reasons:=array_append(reasons,'settings_missing'); END IF;
  RETURN reasons;
END;
$$;

CREATE FUNCTION public.edp_require_sale_workflow_write(p_sale_id uuid,p_client_id uuid,p_organization_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_organization_id<>public.get_user_org_id(auth.uid())
    OR NOT public.app_can_view_sale(p_sale_id) OR NOT public.app_can_view_client(p_client_id)
    OR NOT public.edp_is_workflow_actor(p_organization_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerir a venda EDP.' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.edp_require_sale_workflow_write(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.edp_save_draft(p_sale_id uuid,p_expected_revision integer,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.sales; d public.edp_sale_drafts; reasons text[]; responsible_id uuid;
BEGIN
  PERFORM public.edp_validate_draft_payload(p_payload);
  SELECT * INTO s FROM public.sales WHERE id=p_sale_id FOR UPDATE;
  IF NOT FOUND OR s.client_id IS NULL OR s.organization_id<>public.get_user_org_id(auth.uid())
    OR NOT public.app_can_view_sale(s.id) OR NOT public.app_can_view_client(s.client_id) THEN
    RAISE EXCEPTION 'Venda indisponível.' USING ERRCODE='42501';
  END IF;
  PERFORM public.edp_require_sale_workflow_write(s.id,s.client_id,s.organization_id);
  IF p_payload->>'confirm_client_contact_sync'='true' THEN
    IF public.has_module_permission(s.organization_id,'clients','list','edit') IS NOT TRUE THEN
      RAISE EXCEPTION 'Sem permissão para editar clientes.' USING ERRCODE='42501';
    END IF;
    responsible_id:=nullif(p_payload->>'responsible_person_id','')::uuid;
    UPDATE public.client_people p SET phone=nullif(btrim(p_payload->'responsible'->>'phone'),''),
      email=nullif(btrim(p_payload->'responsible'->>'email'),'')
    WHERE p.id=responsible_id AND p.client_id=s.client_id
      AND EXISTS(SELECT 1 FROM public.client_person_roles r WHERE r.person_id=p.id AND r.role='decision_maker');
    IF NOT FOUND THEN RAISE EXCEPTION 'Responsável indisponível.' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT * INTO d FROM public.edp_sale_drafts WHERE sale_id=s.id FOR UPDATE;
  IF (NOT FOUND AND p_expected_revision<>0) OR (FOUND AND d.revision<>p_expected_revision) THEN
    RAISE EXCEPTION 'edp_revision_conflict' USING ERRCODE='40001';
  END IF;
  reasons:=public.edp_draft_blockers(s.id,p_payload);
  INSERT INTO public.edp_sale_drafts(sale_id,organization_id,client_id,revision,payload,readiness,blocking_reasons,updated_by)
  VALUES(s.id,s.organization_id,s.client_id,p_expected_revision+1,p_payload,CASE WHEN cardinality(reasons)=0 THEN 'ready' ELSE 'blocked' END,reasons,auth.uid())
  ON CONFLICT(sale_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,readiness=excluded.readiness,
    blocking_reasons=excluded.blocking_reasons,updated_by=auth.uid(),updated_at=clock_timestamp() RETURNING * INTO d;
  RETURN jsonb_build_object('sale_id',d.sale_id,'revision',d.revision,'payload',d.payload,'readiness',d.readiness,
    'blocking_reasons',to_jsonb(d.blocking_reasons),'updated_at',d.updated_at);
END;
$$;
REVOKE ALL ON FUNCTION public.edp_validate_draft_payload(jsonb),public.edp_draft_blockers(uuid,jsonb),public.edp_save_draft(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edp_validate_draft_payload(jsonb),public.edp_draft_blockers(uuid,jsonb),public.edp_save_draft(uuid,integer,jsonb) TO authenticated;

CREATE TABLE public.edp_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE RESTRICT,
  draft_revision integer NOT NULL CHECK(draft_revision>0),idempotency_key uuid NOT NULL,snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
  attachment_manifest jsonb NOT NULL CHECK(jsonb_typeof(attachment_manifest)='array'),content_hash text NOT NULL,
  state text NOT NULL CHECK(state IN ('reserved','accepted','failed','uncertain')),email_send_id uuid,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  accepted_at timestamptz,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organization_id,sale_id,idempotency_key)
);
CREATE TABLE public.edp_dispatch_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),dispatch_id uuid NOT NULL REFERENCES public.edp_dispatches(id) ON DELETE RESTRICT,
  attempt_no integer NOT NULL CHECK(attempt_no>0),state text NOT NULL CHECK(state IN ('started','accepted','failed','uncertain')),
  transport text NOT NULL DEFAULT 'local_capture' CHECK(transport IN ('local_capture','brevo')),message_id text,error_code text,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),finished_at timestamptz,UNIQUE(dispatch_id,attempt_no)
);
CREATE TABLE public.edp_dispatch_attachments (
  dispatch_id uuid NOT NULL REFERENCES public.edp_dispatches(id) ON DELETE RESTRICT,
  version_id uuid NOT NULL REFERENCES public.client_document_versions(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES public.client_documents(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK(position>=0),filename text NOT NULL,mime_type text NOT NULL,size_bytes bigint NOT NULL,sha256 text NOT NULL,
  PRIMARY KEY(dispatch_id,version_id)
);
CREATE TABLE public.edp_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),dispatch_id uuid NOT NULL REFERENCES public.edp_dispatches(id) ON DELETE RESTRICT,
  event_key text NOT NULL,event_type text NOT NULL CHECK(event_type IN ('delivered','opened','failed')),
  occurred_at timestamptz NOT NULL,synthetic boolean NOT NULL DEFAULT true CHECK(synthetic),created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dispatch_id,event_key)
);
CREATE INDEX edp_dispatches_sale_idx ON public.edp_dispatches(sale_id,created_at DESC);
CREATE INDEX edp_dispatches_client_idx ON public.edp_dispatches(client_id,created_at DESC);
ALTER TABLE public.edp_dispatches ENABLE ROW LEVEL SECURITY; ALTER TABLE public.edp_dispatch_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edp_dispatch_attachments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.edp_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edp_dispatches,public.edp_dispatch_attempts,public.edp_dispatch_attachments,public.edp_delivery_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.edp_dispatches,public.edp_dispatch_attempts,public.edp_dispatch_attachments,public.edp_delivery_events TO authenticated;
GRANT ALL ON public.edp_dispatches,public.edp_dispatch_attempts,public.edp_dispatch_attachments,public.edp_delivery_events TO service_role;
CREATE POLICY edp_dispatches_select ON public.edp_dispatches FOR SELECT TO authenticated
USING(organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_sale(sale_id) AND public.app_can_view_client(client_id));
CREATE POLICY edp_dispatch_attempts_select ON public.edp_dispatch_attempts FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.edp_dispatches d WHERE d.id=dispatch_id AND d.organization_id=public.get_user_org_id(auth.uid())
  AND public.app_can_view_sale(d.sale_id) AND public.app_can_view_client(d.client_id)));
CREATE POLICY edp_dispatch_attachments_select ON public.edp_dispatch_attachments FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.edp_dispatches d WHERE d.id=dispatch_id AND d.organization_id=public.get_user_org_id(auth.uid())
  AND public.app_can_view_sale(d.sale_id) AND public.app_can_view_client(d.client_id)));
CREATE POLICY edp_delivery_events_select ON public.edp_delivery_events FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.edp_dispatches d WHERE d.id=dispatch_id AND d.organization_id=public.get_user_org_id(auth.uid())
  AND public.app_can_view_sale(d.sale_id) AND public.app_can_view_client(d.client_id)));

ALTER TABLE public.email_sends ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.email_sends ADD CONSTRAINT email_sends_origin_check CHECK(origin IN ('legacy','edp'));
ALTER TABLE public.email_sends ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;
ALTER TABLE public.email_sends ADD COLUMN IF NOT EXISTS edp_dispatch_id uuid REFERENCES public.edp_dispatches(id) ON DELETE SET NULL;
ALTER TABLE public.email_sends ADD COLUMN IF NOT EXISTS transport_status text CHECK(transport_status IS NULL OR transport_status IN ('accepted','failed','uncertain'));
ALTER TABLE public.email_sends ADD COLUMN IF NOT EXISTS synthetic_event boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX email_sends_edp_dispatch_unique ON public.email_sends(edp_dispatch_id) WHERE edp_dispatch_id IS NOT NULL;
ALTER TABLE public.edp_dispatches ADD CONSTRAINT edp_dispatches_email_send_fkey FOREIGN KEY(email_send_id) REFERENCES public.email_sends(id) ON DELETE SET NULL;
CREATE POLICY edp_email_sends_scope_guard ON public.email_sends AS RESTRICTIVE FOR SELECT TO authenticated USING(
  origin<>'edp' OR (organization_id=public.get_user_org_id(auth.uid()) AND public.app_can_view_sale(sale_id) AND public.app_can_view_client(client_id)));

CREATE FUNCTION public.edp_escape_html(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT replace(replace(replace(replace(replace(coalesce(p_value,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;')
$$;
CREATE FUNCTION public.edp_render_template(p_template text,p_client_name text,p_client_nif text,p_proposal_number text,p_energy_type text,p_billing_email text,p_html boolean)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT replace(replace(replace(replace(replace(p_template,
    '{{client_name}}',CASE WHEN p_html THEN public.edp_escape_html(p_client_name) ELSE coalesce(p_client_name,'') END),
    '{{client_nif}}',CASE WHEN p_html THEN public.edp_escape_html(p_client_nif) ELSE coalesce(p_client_nif,'') END),
    '{{proposal_number}}',CASE WHEN p_html THEN public.edp_escape_html(p_proposal_number) ELSE coalesce(p_proposal_number,'') END),
    '{{energy_type}}',CASE WHEN p_html THEN public.edp_escape_html(p_energy_type) ELSE coalesce(p_energy_type,'') END),
    '{{billing_email}}',CASE WHEN p_html THEN public.edp_escape_html(p_billing_email) ELSE coalesce(p_billing_email,'') END)
$$;

CREATE FUNCTION public.edp_dispatch_json(p_dispatch_id uuid,p_same_request boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('dispatch_id',d.id,'attempt_id',a.id,'state',d.state,'same_request',p_same_request,
    'snapshot',d.snapshot,'attachment_manifest',d.attachment_manifest)
  FROM public.edp_dispatches d JOIN LATERAL(SELECT id FROM public.edp_dispatch_attempts WHERE dispatch_id=d.id ORDER BY attempt_no DESC LIMIT 1)a ON true
  WHERE d.id=p_dispatch_id AND d.organization_id=public.get_user_org_id(auth.uid())
    AND public.app_can_view_sale(d.sale_id) AND public.app_can_view_client(d.client_id)
$$;

CREATE FUNCTION public.edp_reserve_dispatch(p_sale_id uuid,p_expected_revision integer,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.sales; c public.crm_clients; d public.edp_sale_drafts; existing public.edp_dispatches; dispatch public.edp_dispatches;
  attempt public.edp_dispatch_attempts; settings public.edp_settings; cert public.client_certificate_versions; person public.client_people;
  reasons text[]; manifest jsonb; checklist jsonb; snapshot jsonb; rendered_subject text; rendered_html text; encoded_size numeric;
BEGIN
  IF auth.uid() IS NULL OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Pedido EDP inválido.' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_sale_id::text,1));
  SELECT * INTO s FROM public.sales WHERE id=p_sale_id FOR UPDATE;
  IF NOT FOUND OR s.client_id IS NULL OR s.organization_id<>public.get_user_org_id(auth.uid())
    OR NOT public.app_can_view_sale(s.id) OR NOT public.app_can_view_client(s.client_id) THEN RAISE EXCEPTION 'Venda indisponível.' USING ERRCODE='42501'; END IF;
  PERFORM public.edp_require_sale_workflow_write(s.id,s.client_id,s.organization_id);
  SELECT * INTO existing FROM public.edp_dispatches WHERE organization_id=s.organization_id AND sale_id=s.id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF existing.draft_revision<>p_expected_revision THEN RAISE EXCEPTION 'edp_revision_conflict' USING ERRCODE='40001'; END IF;
    IF existing.state='reserved' AND NOT EXISTS(SELECT 1 FROM public.edp_settings gate
      WHERE gate.organization_id=s.organization_id AND gate.send_enabled) THEN
      RAISE EXCEPTION 'edp_send_disabled' USING ERRCODE='55000';
    END IF;
    RETURN public.edp_dispatch_json(existing.id,true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.edp_dispatches x WHERE x.sale_id=s.id AND x.draft_revision=p_expected_revision AND x.state='uncertain') THEN
    RAISE EXCEPTION 'edp_dispatch_uncertain' USING ERRCODE='55000';
  END IF;
  IF EXISTS(SELECT 1 FROM public.edp_dispatches x WHERE x.sale_id=s.id AND x.draft_revision=p_expected_revision AND x.state='accepted') THEN
    RAISE EXCEPTION 'edp_dispatch_already_accepted' USING ERRCODE='55000';
  END IF;
  SELECT * INTO d FROM public.edp_sale_drafts WHERE sale_id=s.id FOR UPDATE;
  IF NOT FOUND OR d.revision<>p_expected_revision THEN RAISE EXCEPTION 'edp_revision_conflict' USING ERRCODE='40001'; END IF;
  PERFORM public.edp_validate_draft_payload(d.payload); reasons:=public.edp_draft_blockers(s.id,d.payload);
  IF cardinality(reasons)>0 THEN RAISE EXCEPTION 'edp_not_ready: %',array_to_string(reasons,',') USING ERRCODE='22023'; END IF;
  SELECT * INTO c FROM public.crm_clients WHERE id=s.client_id;
  SELECT * INTO settings FROM public.edp_settings WHERE organization_id=s.organization_id;
  IF NOT settings.send_enabled THEN RAISE EXCEPTION 'edp_send_disabled' USING ERRCODE='55000'; END IF;
  SELECT * INTO cert FROM public.client_certificate_versions WHERE id=(d.payload->>'certificate_version_id')::uuid AND client_id=c.id AND superseded_at IS NULL;
  SELECT * INTO person FROM public.client_people WHERE id=(d.payload->>'responsible_person_id')::uuid AND client_id=c.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('version_id',v.id,'document_id',v.document_id,'bucket_id',v.bucket_id,
    'storage_path',v.storage_path,'filename',v.original_name,'mime_type',v.mime_type,'size_bytes',v.size_bytes,'sha256',v.sha256)
    ORDER BY selected.position),'[]'::jsonb),coalesce(sum(((v.size_bytes+2)/3)*4),0)
  INTO manifest,encoded_size FROM jsonb_array_elements_text(d.payload->'selected_document_version_ids') WITH ORDINALITY selected(id,position)
  JOIN public.client_document_versions v ON v.id=selected.id::uuid JOIN public.client_documents doc ON doc.id=v.document_id
  WHERE v.client_id=c.id AND doc.archived_at IS NULL;
  IF jsonb_array_length(manifest)<>jsonb_array_length(d.payload->'selected_document_version_ids') THEN RAISE EXCEPTION 'Anexo EDP indisponível.' USING ERRCODE='22023'; END IF;
  rendered_subject:=regexp_replace(public.edp_render_template(settings.subject_template,c.name,coalesce(c.company_nif,c.nif),d.payload->>'proposal_number',d.payload->>'energy_type',d.payload->>'billing_email',false),'[\r\n]+',' ','g');
  rendered_html:=public.edp_render_template(settings.body_template,c.name,coalesce(c.company_nif,c.nif),d.payload->>'proposal_number',d.payload->>'energy_type',d.payload->>'billing_email',true);
  IF encoded_size+octet_length(rendered_html)+octet_length(rendered_subject)>26214400 THEN RAISE EXCEPTION 'Mensagem EDP excede 25 MiB.' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('rule_id',r.id,'category',r.category,'label',r.label,'required',r.required,
    'confirmed',coalesce((SELECT (x->>'confirmed')::boolean FROM jsonb_array_elements(d.payload->'checklist_confirmations') x WHERE x->>'rule_id'=r.id::text),false)) ORDER BY r.position,r.id),'[]'::jsonb)
  INTO checklist FROM public.edp_checklist_rules r WHERE r.organization_id=s.organization_id AND r.energy_type=d.payload->>'energy_type';
  snapshot:=jsonb_build_object('schema_version',1,
    'sale',jsonb_build_object('id',s.id,'organization_id',s.organization_id,'client_id',c.id,'proposal_number',d.payload->>'proposal_number',
      'energy_type',d.payload->>'energy_type','negotiation_type',s.negotiation_type,'supply_points',d.payload->'supply_points'),
    'client',jsonb_build_object('id',c.id,'name',c.name,'nif',coalesce(c.company_nif,c.nif)),
    'responsible',jsonb_build_object('person_id',person.id,'name',person.name,'phone',person.phone,'email',person.email),
    'certificate',jsonb_build_object('version_id',cert.id,'crc_code',cert.crc_code,'valid_until',cert.valid_until,'source',cert.source),
    'preferences',jsonb_build_object('direct_debit',(d.payload->>'direct_debit')::boolean,'electronic_invoice',(d.payload->>'electronic_invoice')::boolean,'billing_email',d.payload->'billing_email'),
    'delivery',jsonb_build_object('to',settings.recipients,'cc',settings.cc_recipients,'sender_name',settings.sender_name,'sender_email',settings.sender_email,
      'transport',settings.transport,'subject',rendered_subject,'html',rendered_html),
    'checklist',checklist,'attachments',manifest,'draft_revision',d.revision,'created_at',clock_timestamp());
  INSERT INTO public.edp_dispatches(organization_id,sale_id,client_id,draft_revision,idempotency_key,snapshot,attachment_manifest,content_hash,state,created_by)
  VALUES(s.organization_id,s.id,c.id,d.revision,p_idempotency_key,snapshot,manifest,md5(snapshot::text||manifest::text),'reserved',auth.uid()) RETURNING * INTO dispatch;
  INSERT INTO public.edp_dispatch_attachments(dispatch_id,version_id,document_id,position,filename,mime_type,size_bytes,sha256)
  SELECT dispatch.id,v.id,v.document_id,(selected.position-1)::integer,v.original_name,v.mime_type,v.size_bytes,v.sha256
  FROM jsonb_array_elements_text(d.payload->'selected_document_version_ids') WITH ORDINALITY selected(id,position)
  JOIN public.client_document_versions v ON v.id=selected.id::uuid;
  INSERT INTO public.edp_dispatch_attempts(dispatch_id,attempt_no,state,transport)
  VALUES(dispatch.id,1,'started',settings.transport) RETURNING * INTO attempt;
  RETURN public.edp_dispatch_json(dispatch.id,false);
END;
$$;

CREATE FUNCTION public.edp_protect_dispatch_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.sale_id IS DISTINCT FROM OLD.sale_id
    OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.draft_revision IS DISTINCT FROM OLD.draft_revision
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW.attachment_manifest IS DISTINCT FROM OLD.attachment_manifest OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Snapshot EDP imutável.' USING ERRCODE='55000';
  END IF;
  NEW.updated_at:=clock_timestamp(); RETURN NEW;
END;
$$;
CREATE TRIGGER edp_dispatch_snapshot_immutable BEFORE UPDATE ON public.edp_dispatches
FOR EACH ROW EXECUTE FUNCTION public.edp_protect_dispatch_snapshot();

CREATE FUNCTION public.edp_complete_dispatch(p_dispatch_id uuid,p_attempt_id uuid,p_state text,p_message_id text DEFAULT NULL,p_error_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE d public.edp_dispatches; a public.edp_dispatch_attempts; email_id uuid; status_value text;
BEGIN
  IF p_state NOT IN ('accepted','failed','uncertain') THEN RAISE EXCEPTION 'Resultado EDP inválido.' USING ERRCODE='22023'; END IF;
  SELECT * INTO d FROM public.edp_dispatches WHERE id=p_dispatch_id FOR UPDATE;
  SELECT * INTO a FROM public.edp_dispatch_attempts WHERE id=p_attempt_id AND dispatch_id=p_dispatch_id FOR UPDATE;
  IF d.id IS NULL OR a.id IS NULL THEN RAISE EXCEPTION 'Tentativa EDP indisponível.' USING ERRCODE='22023'; END IF;
  IF a.state<>'started' THEN RETURN jsonb_build_object('dispatch_id',d.id,'state',d.state,'message_id',a.message_id); END IF;
  UPDATE public.edp_dispatch_attempts SET state=p_state,message_id=p_message_id,error_code=p_error_code,finished_at=clock_timestamp() WHERE id=a.id;
  UPDATE public.edp_dispatches SET state=p_state,accepted_at=CASE WHEN p_state='accepted' THEN clock_timestamp() ELSE accepted_at END WHERE id=d.id RETURNING * INTO d;
  status_value:=CASE p_state WHEN 'accepted' THEN 'sent' WHEN 'failed' THEN 'failed' ELSE 'queued' END;
  INSERT INTO public.email_sends(organization_id,client_id,recipient_email,subject,status,error_message,sent_at,sent_by,origin,sale_id,edp_dispatch_id,transport_status,brevo_message_id)
  VALUES(d.organization_id,d.client_id,d.snapshot#>>'{delivery,to,0}',d.snapshot#>>'{delivery,subject}',status_value,p_error_code,
    CASE WHEN p_state='accepted' THEN clock_timestamp() END,d.created_by,'edp',d.sale_id,d.id,p_state,p_message_id)
  ON CONFLICT(edp_dispatch_id) WHERE edp_dispatch_id IS NOT NULL DO UPDATE SET status=excluded.status,error_message=excluded.error_message,
    sent_at=excluded.sent_at,transport_status=excluded.transport_status,brevo_message_id=excluded.brevo_message_id RETURNING id INTO email_id;
  UPDATE public.edp_dispatches SET email_send_id=email_id WHERE id=d.id;
  RETURN jsonb_build_object('dispatch_id',d.id,'state',p_state,'message_id',p_message_id);
END;
$$;

CREATE FUNCTION public.edp_mark_dispatch_inflight(p_dispatch_id uuid,p_attempt_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  UPDATE public.edp_dispatches d SET state='uncertain' WHERE d.id=p_dispatch_id AND d.state='reserved'
    AND EXISTS(SELECT 1 FROM public.edp_dispatch_attempts a WHERE a.id=p_attempt_id AND a.dispatch_id=d.id AND a.state='started');
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa EDP indisponível.' USING ERRCODE='55000'; END IF;
END;
$$;

CREATE FUNCTION public.edp_record_local_event(p_dispatch_id uuid,p_event_key text,p_event_type text,p_occurred_at timestamptz)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE next_status text;
BEGIN
  IF p_event_type NOT IN ('delivered','opened','failed') OR nullif(p_event_key,'') IS NULL THEN RAISE EXCEPTION 'Evento EDP inválido.' USING ERRCODE='22023'; END IF;
  INSERT INTO public.edp_delivery_events(dispatch_id,event_key,event_type,occurred_at) VALUES(p_dispatch_id,p_event_key,p_event_type,p_occurred_at) ON CONFLICT DO NOTHING;
  SELECT CASE WHEN bool_or(event_type='opened') THEN 'opened' WHEN bool_or(event_type='delivered') THEN 'delivered'
    WHEN bool_or(event_type='failed') THEN 'failed' ELSE 'sent' END INTO next_status
  FROM public.edp_delivery_events WHERE dispatch_id=p_dispatch_id;
  UPDATE public.email_sends SET status=next_status,synthetic_event=true,
    opened_at=CASE WHEN next_status='opened' THEN coalesce(opened_at,p_occurred_at) ELSE opened_at END
  WHERE edp_dispatch_id=p_dispatch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.edp_escape_html(text),public.edp_render_template(text,text,text,text,text,text,boolean),
  public.edp_dispatch_json(uuid,boolean),public.edp_reserve_dispatch(uuid,integer,uuid),public.edp_complete_dispatch(uuid,uuid,text,text,text),
  public.edp_mark_dispatch_inflight(uuid,uuid),public.edp_record_local_event(uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edp_escape_html(text),public.edp_render_template(text,text,text,text,text,text,boolean),
  public.edp_dispatch_json(uuid,boolean),public.edp_reserve_dispatch(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edp_complete_dispatch(uuid,uuid,text,text,text),public.edp_mark_dispatch_inflight(uuid,uuid),
  public.edp_record_local_event(uuid,text,text,timestamptz) TO service_role;

CREATE VIEW public.edp_report_rows WITH(security_invoker=true) AS
SELECT d.id AS dispatch_id,d.organization_id,d.sale_id,d.client_id,d.state AS dispatch_state,e.transport_status,e.status AS email_status,
  e.sent_at,e.opened_at,e.error_message,e.brevo_message_id AS message_id,e.synthetic_event,d.snapshot,d.attachment_manifest,
  d.created_by,p.full_name AS created_by_name,d.created_at,d.accepted_at
FROM public.edp_dispatches d LEFT JOIN public.email_sends e ON e.id=d.email_send_id
LEFT JOIN public.profiles p ON p.id=d.created_by;
GRANT SELECT ON public.edp_report_rows TO authenticated,service_role;

CREATE FUNCTION public.edp_get_sale_context(p_sale_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.sales; c public.crm_clients; settings_response jsonb; people jsonb; certificates jsonb; documents jsonb;
  draft jsonb; history jsonb; points jsonb; energy text; suggested jsonb; current_certificate uuid;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id=p_sale_id;
  IF NOT FOUND OR s.client_id IS NULL OR s.organization_id<>public.get_user_org_id(auth.uid())
    OR NOT public.app_can_view_sale(s.id) OR NOT public.app_can_view_client(s.client_id) THEN RAISE EXCEPTION 'Venda indisponível.' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.crm_clients WHERE id=s.client_id;
  settings_response:=public.edp_get_settings();
  SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.created_at,v.person_id,v.role),'[]'::jsonb) INTO people
    FROM public.client_people_roles v WHERE v.client_id=c.id;
  SELECT coalesce(jsonb_agg(to_jsonb(v)-'id' ORDER BY v.recorded_at DESC,v.version_id DESC),'[]'::jsonb),
    (SELECT version_id FROM public.client_certificate_history h WHERE h.client_id=c.id AND h.is_current LIMIT 1)
  INTO certificates,current_certificate FROM public.client_certificate_history v WHERE v.client_id=c.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('document_id',doc.id,'version_id',v.id,'person_id',doc.person_id,'category',doc.category,
    'label',doc.label,'side',v.side,'original_name',v.original_name,'mime_type',v.mime_type,'size_bytes',v.size_bytes,'sha256',v.sha256,
    'validity_suggested_on',v.validity_suggested_on,'validity_confirmed_on',v.validity_confirmed_on,'created_at',v.created_at)
    ORDER BY v.created_at DESC,v.id),'[]'::jsonb) INTO documents
  FROM public.client_documents doc JOIN public.client_document_versions v ON v.document_id=doc.id WHERE doc.client_id=c.id AND doc.archived_at IS NULL;
  SELECT coalesce(jsonb_agg(jsonb_build_object('kind',CASE WHEN coalesce(pc.service_type,'')='gas' THEN 'cui' ELSE 'cpe' END,
    'code',pc.serial_number,'contract_start_date',pc.contrato_inicio) ORDER BY pc.created_at,pc.id),'[]'::jsonb)
  INTO points FROM public.proposal_cpes pc WHERE pc.proposal_id=s.proposal_id AND nullif(btrim(pc.serial_number),'') IS NOT NULL;
  IF jsonb_array_length(points)=0 THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('kind',CASE WHEN coalesce(e.service_type,'')='gas' THEN 'cui' ELSE 'cpe' END,
      'code',e.serial_number,'contract_start_date',e.fidelizacao_start) ORDER BY e.id),'[]'::jsonb)
    INTO points FROM public.cpes e WHERE e.client_id=c.id AND nullif(btrim(e.serial_number),'') IS NOT NULL;
  END IF;
  energy:=CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(points) p WHERE p->>'kind'='cpe')
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(points) p WHERE p->>'kind'='cui') THEN 'ee_gn'
    WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(points) p WHERE p->>'kind'='cui') THEN 'gn'
    WHEN coalesce(s.service_type,'')='gas' THEN 'gn' ELSE 'ee' END;
  suggested:=jsonb_build_object('energy_type',energy,'proposal_number',coalesce(s.edp_proposal_number,''),'supply_points',points,
    'responsible_person_id',NULL,'responsible',NULL,'confirm_client_contact_sync',false,'certificate_version_id',current_certificate,
    'direct_debit',NULL,'electronic_invoice',NULL,'billing_email',NULL,'selected_document_version_ids','[]'::jsonb,
    'checklist_confirmations','[]'::jsonb,'paid_extraction_requested',false);
  SELECT jsonb_build_object('sale_id',d.sale_id,'revision',d.revision,'payload',d.payload,'readiness',d.readiness,
    'blocking_reasons',to_jsonb(d.blocking_reasons),'updated_at',d.updated_at) INTO draft FROM public.edp_sale_drafts d WHERE d.sale_id=s.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('dispatch_id',r.dispatch_id,'sale_id',r.sale_id,'state',r.dispatch_state,
    'snapshot',r.snapshot,'attachment_manifest',r.attachment_manifest,'email_send_id',d.email_send_id,'created_by',r.created_by,
    'created_by_name',r.created_by_name,'created_at',r.created_at,'accepted_at',r.accepted_at) ORDER BY r.created_at DESC,r.dispatch_id),'[]'::jsonb)
  INTO history FROM public.edp_report_rows r JOIN public.edp_dispatches d ON d.id=r.dispatch_id WHERE r.sale_id=s.id;
  RETURN jsonb_build_object('sale',jsonb_build_object('id',s.id,'organization_id',s.organization_id,'client_id',s.client_id,
    'proposal_id',s.proposal_id,'proposal_type',s.proposal_type,'negotiation_type',s.negotiation_type,'edp_proposal_number',s.edp_proposal_number,'created_by',s.created_by),
    'client',jsonb_build_object('id',c.id,'name',c.name,'nif',coalesce(c.company_nif,c.nif),'assigned_to',c.assigned_to),
    'people',people,'certificate_history',certificates,'documents',documents,'settings',settings_response->'settings',
    'checklist',settings_response->'checklist','suggested_payload',suggested,'draft',draft,'history',history);
END;
$$;
REVOKE ALL ON FUNCTION public.edp_get_sale_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edp_get_sale_context(uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
