-- Pure mapping; no new table access or changes to the existing conversion permissions.
CREATE FUNCTION public.mj_decision_makers(_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  people jsonb := '[]';
  person jsonb;
  entry jsonb;
  matches integer;
  match_index integer;
  person_name text;
  name_key text;
  person_nif text;
  person_role text;
  group_name text;
BEGIN
  IF _metadata->>'source_portal' IS DISTINCT FROM 'publicacoes.mj.pt' THEN RETURN people; END IF;
  FOREACH group_name IN ARRAY ARRAY['gerentes','socios'] LOOP
    FOR person IN SELECT value FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(_metadata->group_name)='array' THEN _metadata->group_name ELSE '[]'::jsonb END
    ) LOOP
      IF jsonb_typeof(person)<>'object' OR jsonb_typeof(person->'nome') IS DISTINCT FROM 'string' THEN CONTINUE; END IF;
      person_name := btrim(regexp_replace(person->>'nome','[[:space:]]+',' ','g'));
      IF person_name='' THEN CONTINUE; END IF;
      name_key := translate(lower(person_name),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc');
      person_nif := nullif(regexp_replace(coalesce(person->>'nif',''),'[^0-9]','','g'),'');
      person_role := coalesce(nullif(btrim(person->>'cargo'),''),CASE group_name WHEN 'gerentes' THEN 'Gerente' ELSE 'Sócio' END);
      SELECT count(*),min((ordinality-1)::integer) INTO matches,match_index
      FROM jsonb_array_elements(people) WITH ORDINALITY p
      WHERE (person_nif IS NOT NULL AND p.value->>'nif'=person_nif)
        OR (p.value->>'_name_key'=name_key AND (person_nif IS NULL OR p.value->>'nif' IS NULL));
      IF matches=1 THEN
        entry := people->match_index;
        IF NOT (entry->'_roles' ? person_role) THEN
          entry := jsonb_set(entry,'{_roles}',entry->'_roles'||jsonb_build_array(person_role));
        END IF;
        entry := entry || jsonb_build_object('nif',coalesce(entry->>'nif',person_nif));
        IF coalesce(entry->>'email','')='' AND jsonb_typeof(person->'email')='string' THEN
          entry := entry||jsonb_build_object('email',btrim(person->>'email'));
        END IF;
        IF coalesce(entry->>'phone','')='' AND jsonb_typeof(person->'telefone')='string' THEN
          entry := entry||jsonb_build_object('phone',btrim(person->>'telefone'));
        END IF;
        people := jsonb_set(people,ARRAY[match_index::text],entry);
      ELSE
        people := people||jsonb_build_array(jsonb_build_object(
          'name',person_name,'nif',person_nif,'_name_key',name_key,'_roles',jsonb_build_array(person_role),
          'email',CASE WHEN jsonb_typeof(person->'email')='string' THEN btrim(person->>'email') ELSE '' END,
          'phone',CASE WHEN jsonb_typeof(person->'telefone')='string' THEN btrim(person->>'telefone') ELSE '' END));
      END IF;
    END LOOP;
  END LOOP;
  RETURN coalesce((SELECT jsonb_agg((value-'_name_key'-'_roles')||jsonb_build_object(
    'role',(SELECT string_agg(role,' / ' ORDER BY pos) FROM jsonb_array_elements_text(value->'_roles') WITH ORDINALITY r(role,pos))) ORDER BY ordinality)
    FROM jsonb_array_elements(people) WITH ORDINALITY),'[]'::jsonb);
END;
$$;

CREATE FUNCTION public.fill_mj_lead_decision_makers()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE decision_makers jsonb;
BEGIN
  IF NEW.custom_data->'metadata'->>'source_portal'='publicacoes.mj.pt'
    AND (NEW.custom_data->'decision_makers' IS NULL OR NEW.custom_data->'decision_makers' IN ('null'::jsonb,'[]'::jsonb)) THEN
    decision_makers := public.mj_decision_makers(NEW.custom_data->'metadata');
    IF jsonb_array_length(decision_makers)>0 THEN
      NEW.custom_data := NEW.custom_data||jsonb_build_object('decision_makers',decision_makers);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fill_mj_lead_decision_makers BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fill_mj_lead_decision_makers();
