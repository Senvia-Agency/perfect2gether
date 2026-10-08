-- Local follow-up: administrators manage RH; collaborators request and read their own data.
CREATE OR REPLACE FUNCTION public.rh_admin (_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT rh_member(_org) AND (
   has_role(auth.uid(), 'super_admin'::app_role)
   OR EXISTS (SELECT 1 FROM organization_members m
     LEFT JOIN organization_profiles p ON p.id=m.profile_id AND p.organization_id=m.organization_id
     WHERE m.organization_id=_org AND m.user_id=auth.uid() AND m.is_active
       AND (p.base_role::text='admin' OR (p.id IS NULL AND has_role(auth.uid(),'admin'::app_role))))
 );
$$;
REVOKE ALL ON FUNCTION public.rh_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rh_can (_org uuid, _area text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT rh_admin(_org)
   AND _area IN ('absences','balances','calendar','employees','documents','support','communication')
   AND _action IN ('view','manage','approve');
$$;

ALTER FUNCTION public.rh_absence_mutate(uuid,text,jsonb) RENAME TO rh_absence_mutate_internal;
REVOKE ALL ON FUNCTION public.rh_absence_mutate_internal(uuid,text,jsonb) FROM PUBLIC, authenticated, service_role;
CREATE FUNCTION public.rh_absence_mutate (_org uuid, _action text, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT rh_member(_org) THEN RAISE EXCEPTION 'Acesso RH negado'; END IF;
 IF NOT rh_admin(_org) AND (
   _action IS DISTINCT FROM 'create'
   OR COALESCE((_payload->>'user_id')::uuid,auth.uid()) IS DISTINCT FROM auth.uid()
 ) THEN RAISE EXCEPTION 'Só o administrador pode gerir marcações'; END IF;
 RETURN rh_absence_mutate_internal(_org,_action,_payload);
END;
$$;
REVOKE ALL ON FUNCTION public.rh_absence_mutate(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_absence_mutate(uuid,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_snapshot (_org uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
  AS $$
BEGIN
  IF NOT rh_member (_org) THEN
    RAISE EXCEPTION 'Acesso RH negado';
  END IF;
  RETURN jsonb_build_object('calendar', rh_calendar (_org), 'members', rh_directory (_org), 'permissions', jsonb_build_object('administration.manage', rh_admin (_org)) || (
      SELECT
        jsonb_object_agg(area || '.' || action, rh_can (_org, area, action))
      FROM unnest(ARRAY['absences', 'balances', 'calendar', 'employees', 'documents', 'support', 'communication'])
      area
    CROSS JOIN unnest(ARRAY['view', 'manage', 'approve']) action), 'absences', COALESCE((
    SELECT
      jsonb_agg(to_jsonb (a) || jsonb_build_object('periods', (
          SELECT
            COALESCE(jsonb_agg(p), '[]')
          FROM rh_absence_periods p
        WHERE
          p.absence_id = a.id)))
    FROM rh_absences a
  WHERE
    organization_id = _org), '[]'), 'balances', COALESCE((
  SELECT
    jsonb_agg(b)
  FROM rh_vacation_balances b
WHERE
  organization_id = _org), '[]'), 'records', COALESCE((
  SELECT
    jsonb_agg(r ORDER BY r.created_at)
  FROM rh_records r
WHERE
  organization_id = _org), '[]'), 'history', COALESCE((
  SELECT
    jsonb_agg(to_jsonb (h) || jsonb_build_object('actor_name', rh_actor_name (_org, h.actor_id))
    ORDER BY h.created_at DESC)
  FROM rh_history h
WHERE
  organization_id = _org), '[]'), 'holidays', COALESCE((
  SELECT
    jsonb_agg(h)
  FROM rh_holidays h
WHERE
  organization_id = _org), '[]'), 'notifications', COALESCE((
  SELECT
    jsonb_agg(n ORDER BY due_at DESC)
  FROM rh_notifications n
WHERE
  organization_id = _org), '[]'));
END
$$;


ALTER FUNCTION public.rh_record_save(uuid,text,jsonb,uuid,uuid,uuid) RENAME TO rh_record_save_internal;
REVOKE ALL ON FUNCTION public.rh_record_save_internal(uuid,text,jsonb,uuid,uuid,uuid) FROM PUBLIC, authenticated, service_role;
CREATE FUNCTION public.rh_record_save (_org uuid, _kind text, _data jsonb, _id uuid DEFAULT NULL, _user uuid DEFAULT auth.uid(), _parent uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE effective_data jsonb;
BEGIN
 IF _kind='notice' THEN
   SELECT COALESCE((SELECT data FROM rh_records WHERE id=_id AND organization_id=_org AND kind='notice'),'{}'::jsonb) || _data INTO effective_data;
   IF effective_data->>'active' IS DISTINCT FROM 'false' THEN
     IF jsonb_typeof(effective_data->'recipients') IS DISTINCT FROM 'array' THEN
       RAISE EXCEPTION 'Selecione destinatários para o aviso';
     END IF;
     IF jsonb_array_length(effective_data->'recipients')=0 THEN
       RAISE EXCEPTION 'Selecione destinatários para o aviso';
     END IF;
   END IF;
 END IF;
 RETURN rh_record_save_internal(_org,_kind,_data,_id,_user,_parent);
END;
$$;
REVOKE ALL ON FUNCTION public.rh_record_save(uuid,text,jsonb,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_record_save(uuid,text,jsonb,uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
