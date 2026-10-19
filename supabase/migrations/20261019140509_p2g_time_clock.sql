-- Attendance is an append-only event stream. Privileged mutations are audited.
CREATE SCHEMA IF NOT EXISTS p2g_clock_private;
REVOKE ALL ON SCHEMA p2g_clock_private FROM PUBLIC;
CREATE TABLE public.p2g_clock_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180), radius_m numeric NOT NULL DEFAULT 50 CHECK(radius_m BETWEEN 1 AND 100000),
 max_accuracy_m numeric NOT NULL DEFAULT 100 CHECK(max_accuracy_m BETWEEN 1 AND 10000), gps_only boolean NOT NULL DEFAULT false,
 block_vpn boolean NOT NULL DEFAULT false, trusted_ips text[] NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true,
 UNIQUE(organization_id,id)
);
CREATE TABLE public.p2g_clock_tags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),location_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),kind text NOT NULL CHECK(kind IN ('static','ntag424')),
 token_hash text, aes_key text,uid_hex text,last_counter bigint NOT NULL DEFAULT -1 CHECK(last_counter>=-1),is_active boolean NOT NULL DEFAULT true,
 FOREIGN KEY(organization_id,location_id) REFERENCES public.p2g_clock_locations(organization_id,id),
 CHECK((kind='static' AND token_hash IS NOT NULL AND token_hash ~ '^[0-9a-f]{64}$') OR (kind='ntag424' AND aes_key IS NOT NULL AND aes_key ~ '^[0-9a-fA-F]{32}$' AND uid_hex IS NOT NULL AND uid_hex ~ '^[0-9a-fA-F]{14}$'))
);
CREATE TABLE public.p2g_clock_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid, action text NOT NULL CHECK(action IN ('start','pause','resume','stop')),
 entry_type text NOT NULL CHECK(entry_type IN ('in','out')),kind text NOT NULL CHECK(kind IN ('work','pause')),
 punched_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),status text NOT NULL CHECK(status IN ('valid','pending','flagged','voided')),
 flags text[] NOT NULL DEFAULT '{}',note text NOT NULL DEFAULT '' CHECK(length(note)<=300),location_id uuid,
 location_name text,address text,distance_m numeric CHECK(distance_m>=0),source text NOT NULL CHECK(source IN ('gps','nfc','admin')),
 corrected boolean NOT NULL DEFAULT false,metadata jsonb NOT NULL DEFAULT '{}',
 FOREIGN KEY(organization_id,location_id) REFERENCES public.p2g_clock_locations(organization_id,id),
 UNIQUE(organization_id,user_id,request_id),
 CHECK((action IN ('start','resume') AND entry_type='in' AND kind='work') OR (action='pause' AND entry_type='out' AND kind='pause') OR (action='stop' AND entry_type='out' AND kind='work'))
);
CREATE INDEX p2g_clock_entries_user_time ON public.p2g_clock_entries(organization_id,user_id,punched_at,id);
CREATE TABLE public.p2g_clock_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid,
 entry_id uuid REFERENCES public.p2g_clock_entries(id),actor_id uuid NOT NULL,action text NOT NULL,reason text NOT NULL,
 before_data jsonb,after_data jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.p2g_clock_schedules (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 weekdays integer[] NOT NULL DEFAULT '{1,2,3,4,5}' CHECK(weekdays <@ ARRAY[1,2,3,4,5,6,7]),
 start_time time NOT NULL DEFAULT '09:00',lunch_time time NOT NULL DEFAULT '13:00',return_time time NOT NULL DEFAULT '14:00',end_time time NOT NULL DEFAULT '18:00',
 tolerance_minutes integer NOT NULL DEFAULT 10 CHECK(tolerance_minutes BETWEEN 0 AND 180),enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(organization_id,user_id),CHECK(start_time<lunch_time AND lunch_time<return_time AND return_time<end_time)
);
CREATE TABLE public.p2g_clock_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 title text NOT NULL,body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,event_key text NOT NULL,
 UNIQUE(organization_id,user_id,event_key)
);
CREATE TABLE public.p2g_clock_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 channel text NOT NULL CHECK(channel IN ('notification','push','email')),event_key text NOT NULL,title text NOT NULL,body text NOT NULL,payload jsonb NOT NULL DEFAULT '{}',
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','delivered','failed')),attempts integer NOT NULL DEFAULT 0,
 claimed_at timestamptz,delivered_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,user_id,channel,event_key)
);

CREATE TABLE public.p2g_clock_settings (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 nif text NOT NULL DEFAULT '' CHECK(nif='' OR nif ~ '^[0-9]{9}$'),
 logo_url text CHECK(logo_url IS NULL OR (length(logo_url)<=2048 AND logo_url ~ '^https?://'))
);
CREATE TABLE public.p2g_clock_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,reason text NOT NULL CHECK(reason IN ('invalid_nfc','nfc_replay_or_invalid','gps_required','invalid_nfc_location','network_blocked')),
 input jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,user_id,request_id,reason)
);
CREATE INDEX p2g_clock_history_scope ON public.p2g_clock_history(organization_id,user_id,created_at DESC);
CREATE INDEX p2g_clock_jobs_due ON public.p2g_clock_jobs(state,created_at) WHERE attempts<5;
CREATE FUNCTION p2g_clock_private.member(_org uuid,_user uuid DEFAULT auth.uid()) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=_org AND user_id=_user AND is_active)
$$;
CREATE FUNCTION p2g_clock_private.can(_org uuid,_action text,_user uuid DEFAULT auth.uid()) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT _action IN ('manage','configure') AND p2g_clock_private.member(_org,_user) AND EXISTS(
 SELECT 1 FROM organization_members m LEFT JOIN organization_profiles p ON p.id=m.profile_id AND p.organization_id=m.organization_id
 WHERE m.organization_id=_org AND m.user_id=_user AND m.is_active AND
 (EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=_user AND r.role::text IN ('admin','super_admin'))
 OR p.base_role::text='admin' OR p.module_permissions #>> ARRAY['rh','subareas','timeclock',_action]='true'))
$$;
-- Public helper RPCs reveal only the caller; definer RPCs use private canonical helpers.
CREATE FUNCTION public.p2g_clock_member(_org uuid,_user uuid DEFAULT auth.uid()) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(_user=auth.uid(),false) AND p2g_clock_private.member(_org,_user)
$$;
CREATE FUNCTION public.p2g_clock_can(_org uuid,_action text,_user uuid DEFAULT auth.uid()) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(_user=auth.uid(),false) AND p2g_clock_private.can(_org,_action,_user)
$$;
CREATE FUNCTION p2g_clock_private.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
 BEGIN RAISE EXCEPTION 'immutable_attendance_record'; END $$;
CREATE TRIGGER p2g_clock_audit_immutable BEFORE UPDATE OR DELETE ON public.p2g_clock_history FOR EACH ROW EXECUTE FUNCTION p2g_clock_private.immutable();
CREATE TRIGGER p2g_clock_entry_no_delete BEFORE DELETE ON public.p2g_clock_entries FOR EACH ROW EXECUTE FUNCTION p2g_clock_private.immutable();
CREATE FUNCTION p2g_clock_private.entry_json(e public.p2g_clock_entries) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT to_jsonb(e)-'metadata'-'request_id'
$$;
CREATE FUNCTION p2g_clock_private.reason(_reason text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
 BEGIN IF length(regexp_replace(coalesce(_reason,''),'[^[:alpha:]]','','g'))<3 THEN RAISE EXCEPTION 'reason_required'; END IF; END $$;
CREATE FUNCTION p2g_clock_private.sequence(_org uuid,_user uuid) RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
 DECLARE e record; last_action text; last_at timestamptz; state text:='closed';
 BEGIN
 FOR e IN SELECT action,punched_at FROM p2g_clock_entries WHERE organization_id=_org AND user_id=_user AND status<>'voided' ORDER BY punched_at,id LOOP
  IF last_at IS NOT NULL AND e.punched_at<=last_at THEN RAISE EXCEPTION 'invalid_state'; END IF;
  IF last_at IS NOT NULL AND e.punched_at-last_at>=interval '12 hours' THEN state:='closed'; END IF;
  IF NOT ((state='closed' AND e.action='start') OR (state='working' AND e.action IN ('pause','stop')) OR (state='paused' AND e.action IN ('resume','stop'))) THEN RAISE EXCEPTION 'invalid_state'; END IF;
  state:=CASE e.action WHEN 'start' THEN 'working' WHEN 'resume' THEN 'working' WHEN 'pause' THEN 'paused' ELSE 'closed' END;
  last_at:=e.punched_at;last_action:=e.action;
 END LOOP;
 END $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['locations','tags','entries','history','schedules','notifications','jobs','attempts','settings'] LOOP
 EXECUTE format('ALTER TABLE public.p2g_clock_%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.p2g_clock_%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
-- No table-level writes are exposed. Entries only expose safe columns for direct reads.
GRANT SELECT(id,organization_id,user_id,action,entry_type,kind,punched_at,created_at,status,flags,note,location_id,location_name,address,distance_m,source,corrected) ON public.p2g_clock_entries TO authenticated;
CREATE POLICY p2g_clock_entry_read ON public.p2g_clock_entries FOR SELECT TO authenticated USING
 (public.p2g_mfa_ok() AND public.p2g_clock_member(organization_id) AND (user_id=auth.uid() OR public.p2g_clock_can(organization_id,'manage')));

CREATE FUNCTION public.p2g_clock_register(_org uuid,_user uuid,_input jsonb,_decision jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DECLARE e p2g_clock_entries; prev p2g_clock_entries; stamp timestamptz:=now(); manual boolean:=_input ? 'at';
 act text:=_input->>'action'; req uuid:=(_input->>'request_id')::uuid; fs text[]; tag_row p2g_clock_tags; counter_value bigint;
 BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_only'; END IF;
 IF NOT p2g_clock_private.member(_org,_user) THEN RAISE EXCEPTION 'membership_required'; END IF;
 IF req IS NULL OR act IS NULL OR act NOT IN ('start','pause','resume','stop') OR coalesce(_input->>'device_id','')='' THEN RAISE EXCEPTION 'invalid_input'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_org::text||_user::text,0));
 SELECT * INTO e FROM p2g_clock_entries WHERE organization_id=_org AND user_id=_user AND request_id=req;
 IF FOUND THEN RETURN jsonb_build_object('entry',p2g_clock_private.entry_json(e),'duplicate',true); END IF;
 SELECT * INTO e FROM p2g_clock_entries WHERE organization_id=_org AND user_id=_user AND action=act AND created_at>now()-interval '60 seconds' AND status<>'voided' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('entry',p2g_clock_private.entry_json(e),'duplicate',true); END IF;
 SELECT * INTO prev FROM p2g_clock_entries WHERE organization_id=_org AND user_id=_user AND status<>'voided' ORDER BY punched_at DESC,id DESC LIMIT 1;
 IF manual THEN
  stamp:=(_input->>'at')::timestamptz; PERFORM p2g_clock_private.reason(_input->>'note');
  IF stamp IS NULL OR stamp>now() OR stamp<now()-interval '12 hours' OR (stamp AT TIME ZONE 'Europe/Lisbon')::date<>(now() AT TIME ZONE 'Europe/Lisbon')::date THEN RAISE EXCEPTION 'invalid_manual_time'; END IF;
 END IF;
 IF prev.id IS NOT NULL AND stamp<=prev.punched_at THEN RAISE EXCEPTION 'invalid_manual_time'; END IF;
 IF _decision->>'status' NOT IN ('valid','flagged','pending') OR _decision->>'source' NOT IN ('gps','nfc') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
 fs:=ARRAY(SELECT jsonb_array_elements_text(coalesce(_decision->'flags','[]')));
 IF manual THEN fs:=array_append(fs,'manual_time'); END IF;
 IF _input->'tag' IS NOT NULL AND _input->'tag'<>'null'::jsonb THEN
  -- Row lock + monotonic counter protect NTAG424 proofs across users. Static bearer URLs
  -- remain reusable by anyone holding the token and choosing a higher counter.
  SELECT * INTO tag_row FROM p2g_clock_tags WHERE organization_id=_org AND id=(_input#>>'{tag,id}')::uuid AND is_active FOR UPDATE;
  counter_value:=(_input#>>'{tag,counter}')::bigint;
  IF tag_row.id IS NULL OR (_decision->>'location_id')::uuid IS DISTINCT FROM tag_row.location_id OR counter_value IS NULL OR counter_value<=tag_row.last_counter OR _decision->>'source'<>'nfc' THEN RAISE EXCEPTION 'invalid_nfc'; END IF;
  UPDATE p2g_clock_tags SET last_counter=counter_value WHERE id=tag_row.id;
 ELSIF _decision->>'source'='nfc' THEN RAISE EXCEPTION 'invalid_nfc'; END IF;
 IF act='resume' AND prev.action='stop' AND stamp-prev.punched_at<interval '12 hours' AND (prev.punched_at AT TIME ZONE 'Europe/Lisbon')::date=(stamp AT TIME ZONE 'Europe/Lisbon')::date THEN
  UPDATE p2g_clock_entries SET action='pause',kind='pause',corrected=true WHERE id=prev.id RETURNING * INTO e;
  INSERT INTO p2g_clock_history(organization_id,user_id,entry_id,actor_id,action,reason,before_data,after_data) VALUES(_org,_user,e.id,_user,'resume_day','Dia retomado pelo colaborador',p2g_clock_private.entry_json(prev),p2g_clock_private.entry_json(e));
 END IF;
 INSERT INTO p2g_clock_entries(organization_id,user_id,request_id,action,entry_type,kind,punched_at,status,flags,note,location_id,location_name,address,distance_m,source,corrected,metadata)
 VALUES(_org,_user,req,act,CASE WHEN act IN ('start','resume') THEN 'in' ELSE 'out' END,CASE WHEN act='pause' THEN 'pause' ELSE 'work' END,stamp,
 CASE WHEN manual THEN 'pending' ELSE _decision->>'status' END,fs,coalesce(_input->>'note',''),(_decision->>'location_id')::uuid,_decision->>'location_name',_decision->>'address',(_decision->>'distance_m')::numeric,_decision->>'source',manual,
 coalesce(_decision->'metadata','{}')||jsonb_build_object('device_id',_input->>'device_id','position',_input->'position')) RETURNING * INTO e;
 PERFORM p2g_clock_private.sequence(_org,_user);
 INSERT INTO p2g_clock_history(organization_id,user_id,entry_id,actor_id,action,reason,after_data) VALUES(_org,_user,e.id,_user,CASE WHEN manual THEN 'manual_time' ELSE 'punch' END,CASE WHEN manual THEN _input->>'note' ELSE 'Registo de ponto' END,p2g_clock_private.entry_json(e));
 IF fs && ARRAY['manual_time','new_device','shared_device','repeated_coordinates','perfect_accuracy','teleport','vpn','proxy','tor'] THEN
  INSERT INTO p2g_clock_jobs(organization_id,user_id,channel,event_key,title,body,payload)
  SELECT _org,m.user_id,'email','review:'||e.id,'Ponto para revisão','Existe um registo de ponto com alertas.',jsonb_build_object('entry_id',e.id,'flags',fs)
  FROM organization_members m WHERE m.organization_id=_org AND m.is_active AND p2g_clock_private.can(_org,'manage',m.user_id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN jsonb_build_object('entry',p2g_clock_private.entry_json(e),'duplicate',false);
 END $$;

CREATE FUNCTION public.p2g_clock_context(_org uuid,_user uuid,_request uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_only'; END IF;
 IF NOT p2g_clock_private.member(_org,_user) THEN RAISE EXCEPTION 'membership_required'; END IF;
 RETURN jsonb_build_object('duplicate',(SELECT jsonb_build_object('entry',p2g_clock_private.entry_json(e),'duplicate',true) FROM p2g_clock_entries e WHERE e.organization_id=_org AND e.user_id=_user AND e.request_id=_request),'locations',coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM p2g_clock_locations l WHERE organization_id=_org AND is_active),'[]'),
 'tags',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM p2g_clock_tags t WHERE organization_id=_org AND is_active),'[]'),
 'previous',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT * FROM p2g_clock_entries WHERE organization_id=_org AND user_id=_user AND status<>'voided' ORDER BY punched_at DESC LIMIT 20)e),'[]'),
 'devices',coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('user_id',user_id,'device_id',metadata->>'device_id')) FROM p2g_clock_entries WHERE organization_id=_org AND metadata ? 'device_id'),'[]'));
 END $$;

CREATE FUNCTION public.p2g_clock(action text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DECLARE _action ALIAS FOR $1; _payload ALIAS FOR $2; org uuid:=(_payload->>'org')::uuid; target uuid:=coalesce((_payload->>'user')::uuid,auth.uid());
 manager boolean; config boolean; month_start timestamptz; month_end timestamptz; month_text text:=coalesce(_payload->>'month',to_char(now() AT TIME ZONE 'Europe/Lisbon','YYYY-MM'));
 e p2g_clock_entries; old_entry p2g_clock_entries; loc p2g_clock_locations; old_data jsonb; result jsonb; op text:=_payload->>'op'; stamp timestamptz; act text;
 BEGIN
 IF auth.uid() IS NULL OR NOT p2g_mfa_ok() OR NOT p2g_clock_private.member(org) THEN RAISE EXCEPTION 'access_denied'; END IF;
 manager:=p2g_clock_private.can(org,'manage'); config:=p2g_clock_private.can(org,'configure');
 IF target<>auth.uid() AND NOT manager AND NOT (_action='schedule_save' AND config) THEN RAISE EXCEPTION 'access_denied'; END IF;
 IF _action='snapshot' THEN
  IF month_text !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'invalid_month'; END IF;
  month_start:=(month_text||'-01')::timestamp AT TIME ZONE 'Europe/Lisbon'; month_end:=((month_text||'-01')::date+interval '1 month') AT TIME ZONE 'Europe/Lisbon';
  RETURN jsonb_build_object('report_identity',(SELECT jsonb_build_object('name',coalesce(cs.name,o.name),'nif',coalesce(cs.nif,''),'logo_url',cs.logo_url) FROM organizations o LEFT JOIN p2g_clock_settings cs ON cs.organization_id=o.id WHERE o.id=org),'server_now',now(),'timezone','Europe/Lisbon','can_manage',manager,'can_configure',config,
  'entries',coalesce((SELECT jsonb_agg(p2g_clock_private.entry_json(x) ORDER BY x.punched_at,x.id) FROM p2g_clock_entries x WHERE organization_id=org AND (manager OR user_id=auth.uid()) AND (NOT (_payload ? 'user') OR user_id=target) AND punched_at>=month_start-interval '12 hours' AND punched_at<month_end+interval '12 hours'),'[]'),
  'people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.full_name,'Colaborador'),'avatar',p.avatar_url,'role',coalesce(opr.base_role::text,'collaborator'),'is_active',m.is_active)) FROM organization_members m LEFT JOIN profiles p ON p.id=m.user_id LEFT JOIN organization_profiles opr ON opr.id=m.profile_id AND opr.organization_id=org WHERE m.organization_id=org AND (manager OR m.user_id=auth.uid()) AND (m.is_active OR EXISTS(SELECT 1 FROM p2g_clock_entries x WHERE x.organization_id=org AND x.user_id=m.user_id AND x.punched_at>=month_start AND x.punched_at<month_end))),'[]'),
  'locations',coalesce((SELECT jsonb_agg((to_jsonb(l)-'organization_id')||jsonb_build_object('trusted_ips',CASE WHEN config THEN to_jsonb(l.trusted_ips) ELSE '[]'::jsonb END)) FROM p2g_clock_locations l WHERE organization_id=org),'[]'),
  'tags',CASE WHEN manager OR config THEN coalesce((SELECT jsonb_agg(to_jsonb(t)-'organization_id'-'token_hash'-'aes_key'-'uid_hex') FROM p2g_clock_tags t WHERE organization_id=org),'[]') ELSE '[]'::jsonb END,
  'schedules',coalesce((SELECT jsonb_agg(to_jsonb(s)-'organization_id') FROM p2g_clock_schedules s WHERE organization_id=org AND (manager OR user_id=auth.uid())),'[]'),
  'holidays',coalesce((SELECT jsonb_agg(jsonb_build_object('date',h.date,'name',h.name)) FROM rh_holidays h WHERE organization_id=org AND h.date>=(month_start AT TIME ZONE 'Europe/Lisbon')::date AND h.date<(month_end AT TIME ZONE 'Europe/Lisbon')::date),'[]'),
  'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'entry_id',h.entry_id,'actor_id',h.actor_id,'action',h.action,'reason',h.reason,'created_at',h.created_at,'before',CASE WHEN config THEN h.before_data ELSE h.before_data-'trusted_ips' END,'after',CASE WHEN config THEN h.after_data ELSE h.after_data-'trusted_ips' END) ORDER BY h.created_at DESC) FROM p2g_clock_history h WHERE organization_id=org AND (manager OR (h.user_id=auth.uid() AND h.entry_id IS NOT NULL)) AND (h.entry_id IS NULL OR EXISTS(SELECT 1 FROM p2g_clock_entries x WHERE x.id=h.entry_id AND x.punched_at>=month_start-interval '12 hours' AND x.punched_at<month_end+interval '12 hours'))),'[]'),
  'notifications',coalesce((SELECT jsonb_agg(to_jsonb(n)-'organization_id'-'event_key' ORDER BY n.created_at DESC) FROM p2g_clock_notifications n WHERE organization_id=org AND user_id=auth.uid() AND created_at>now()-interval '90 days'),'[]'));
 ELSIF _action='notification_read' THEN
  UPDATE p2g_clock_notifications SET read_at=coalesce(read_at,now()) WHERE id=(_payload->>'id')::uuid AND organization_id=org AND user_id=auth.uid(); RETURN 'null'::jsonb;
 ELSIF _action='entry_manage' THEN
  IF NOT manager THEN RAISE EXCEPTION 'manage_required'; END IF;
  PERFORM p2g_clock_private.reason(_payload->>'reason');
  IF op<>'create' THEN
   SELECT * INTO old_entry FROM p2g_clock_entries WHERE id=(_payload->>'id')::uuid AND organization_id=org;
   IF NOT FOUND THEN RAISE EXCEPTION 'entry_not_found'; END IF; target:=old_entry.user_id;
  END IF;
  IF target=auth.uid() THEN RAISE EXCEPTION 'own_entry_forbidden'; END IF;
  IF NOT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=org AND user_id=target) THEN RAISE EXCEPTION 'membership_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(org::text||target::text,0));
  IF op='create' THEN
   act:=_payload->>'action';stamp:=(_payload->>'at')::timestamptz;
   IF stamp IS NULL OR stamp>now() THEN RAISE EXCEPTION 'invalid_time'; END IF;
   INSERT INTO p2g_clock_entries(organization_id,user_id,action,entry_type,kind,punched_at,status,note,source,corrected)
   VALUES(org,target,act,CASE WHEN act IN ('start','resume') THEN 'in' ELSE 'out' END,CASE WHEN act='pause' THEN 'pause' ELSE 'work' END,stamp,'valid',coalesce(_payload->>'note',''),'admin',true) RETURNING * INTO e;
  ELSIF op IN ('edit','approve','reject','void','restore') THEN
   SELECT * INTO old_entry FROM p2g_clock_entries WHERE id=old_entry.id FOR UPDATE;
   act:=CASE WHEN op='edit' THEN coalesce(_payload->>'action',old_entry.action) ELSE old_entry.action END;
   stamp:=CASE WHEN op='edit' THEN coalesce((_payload->>'at')::timestamptz,old_entry.punched_at) ELSE old_entry.punched_at END;
   IF stamp>now() THEN RAISE EXCEPTION 'invalid_time'; END IF;
   UPDATE p2g_clock_entries SET action=act,entry_type=CASE WHEN act IN ('start','resume') THEN 'in' ELSE 'out' END,kind=CASE WHEN act='pause' THEN 'pause' ELSE 'work' END,
   punched_at=stamp,note=CASE WHEN op='edit' THEN coalesce(_payload->>'note',note) ELSE note END,
   status=CASE WHEN op IN ('void','reject') THEN 'voided' WHEN op IN ('approve','restore') THEN 'valid' ELSE status END,corrected=old_entry.corrected OR op='edit'
   WHERE id=old_entry.id RETURNING * INTO e;
  ELSE RAISE EXCEPTION 'invalid_operation'; END IF;
  PERFORM p2g_clock_private.sequence(org,target);
  INSERT INTO p2g_clock_history(organization_id,user_id,entry_id,actor_id,action,reason,before_data,after_data)
  VALUES(org,target,e.id,auth.uid(),op,_payload->>'reason',CASE WHEN old_entry.id IS NOT NULL THEN p2g_clock_private.entry_json(old_entry) END,p2g_clock_private.entry_json(e));
  RETURN p2g_clock_private.entry_json(e);
 ELSIF _action='settings_save' THEN
  IF NOT config THEN RAISE EXCEPTION 'configure_required'; END IF;
  PERFORM p2g_clock_private.reason(_payload->>'reason');
  SELECT to_jsonb(s)-'organization_id' INTO old_data FROM p2g_clock_settings s WHERE organization_id=org;
  INSERT INTO p2g_clock_settings(organization_id,name,nif,logo_url)
  VALUES(org,trim(_payload->>'name'),coalesce(trim(_payload->>'nif'),''),nullif(trim(_payload->>'logo_url'),''))
  ON CONFLICT(organization_id) DO UPDATE SET name=excluded.name,nif=excluded.nif,logo_url=excluded.logo_url
  RETURNING to_jsonb(p2g_clock_settings)-'organization_id' INTO result;
  INSERT INTO p2g_clock_history(organization_id,actor_id,action,reason,before_data,after_data)
  VALUES(org,auth.uid(),'settings_save',_payload->>'reason',old_data,result);
  RETURN result; ELSIF _action='location_save' THEN
  IF NOT config THEN RAISE EXCEPTION 'configure_required'; END IF; PERFORM p2g_clock_private.reason(_payload->>'reason');
  SELECT to_jsonb(l) INTO old_data FROM p2g_clock_locations l WHERE id=(_payload->>'id')::uuid AND organization_id=org;
  IF _payload ? 'id' AND old_data IS NULL THEN RAISE EXCEPTION 'location_not_found'; END IF;
  INSERT INTO p2g_clock_locations(id,organization_id,name,latitude,longitude,radius_m,max_accuracy_m,gps_only,block_vpn,trusted_ips,is_active)
  VALUES(coalesce((_payload->>'id')::uuid,gen_random_uuid()),org,_payload->>'name',(_payload->>'latitude')::double precision,(_payload->>'longitude')::double precision,(_payload->>'radius_m')::numeric,(_payload->>'max_accuracy_m')::numeric,(_payload->>'gps_only')::boolean,(_payload->>'block_vpn')::boolean,ARRAY(SELECT jsonb_array_elements_text(coalesce(_payload->'trusted_ips','[]'))),(_payload->>'is_active')::boolean)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,latitude=excluded.latitude,longitude=excluded.longitude,radius_m=excluded.radius_m,max_accuracy_m=excluded.max_accuracy_m,gps_only=excluded.gps_only,block_vpn=excluded.block_vpn,trusted_ips=excluded.trusted_ips,is_active=excluded.is_active RETURNING * INTO loc;
  result:=to_jsonb(loc);
  INSERT INTO p2g_clock_history(organization_id,actor_id,action,reason,before_data,after_data) VALUES(org,auth.uid(),'location_save',_payload->>'reason',old_data,result);
  RETURN to_jsonb(loc)-'organization_id';
 ELSIF _action='schedule_save' THEN
  IF NOT config THEN RAISE EXCEPTION 'configure_required'; END IF; PERFORM p2g_clock_private.reason(_payload->>'reason');
  IF NOT p2g_clock_private.member(org,target) THEN RAISE EXCEPTION 'membership_required'; END IF;
  SELECT to_jsonb(s) INTO old_data FROM p2g_clock_schedules s WHERE organization_id=org AND user_id=target;
  INSERT INTO p2g_clock_schedules(organization_id,user_id,weekdays,start_time,lunch_time,return_time,end_time,tolerance_minutes,enabled)
  VALUES(org,target,ARRAY(SELECT jsonb_array_elements_text(_payload->'weekdays')::integer),(_payload->>'start_time')::time,(_payload->>'lunch_time')::time,(_payload->>'return_time')::time,(_payload->>'end_time')::time,(_payload->>'tolerance_minutes')::integer,(_payload->>'enabled')::boolean)
  ON CONFLICT(organization_id,user_id) DO UPDATE SET weekdays=excluded.weekdays,start_time=excluded.start_time,lunch_time=excluded.lunch_time,return_time=excluded.return_time,end_time=excluded.end_time,tolerance_minutes=excluded.tolerance_minutes,enabled=excluded.enabled RETURNING to_jsonb(p2g_clock_schedules) INTO result;
  INSERT INTO p2g_clock_history(organization_id,user_id,actor_id,action,reason,before_data,after_data) VALUES(org,target,auth.uid(),'schedule_save',_payload->>'reason',old_data,result);
  RETURN result-'organization_id';
 END IF;
 RAISE EXCEPTION 'invalid_action';
 END $$;

CREATE FUNCTION public.p2g_clock_tag_manage(_org uuid,_actor uuid,_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DECLARE t p2g_clock_tags; prior jsonb; op text:=_input->>'op';
 BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_only'; END IF;
 IF NOT p2g_clock_private.can(_org,'configure',_actor) THEN RAISE EXCEPTION 'configure_required'; END IF;
 PERFORM p2g_clock_private.reason(_input->>'reason');
 IF op='create' THEN
  INSERT INTO p2g_clock_tags(organization_id,location_id,name,kind,token_hash,aes_key,uid_hex)
  VALUES(_org,(_input->>'location_id')::uuid,_input->>'name',_input->>'kind',_input->>'token_hash',_input->>'aes_key',_input->>'uid_hex') RETURNING * INTO t;
 ELSIF op IN ('rotate','disable') THEN
  SELECT * INTO t FROM p2g_clock_tags WHERE organization_id=_org AND id=(_input->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tag_not_found'; END IF;
  prior:=to_jsonb(t)-'token_hash'-'aes_key'-'uid_hex';
  UPDATE p2g_clock_tags SET token_hash=CASE WHEN op='rotate' THEN _input->>'token_hash' ELSE token_hash END,
  aes_key=CASE WHEN op='rotate' THEN _input->>'aes_key' ELSE aes_key END,uid_hex=coalesce(_input->>'uid_hex',uid_hex),last_counter=CASE WHEN op='rotate' THEN -1 ELSE last_counter END,
  is_active=op<>'disable' WHERE id=t.id RETURNING * INTO t;
 ELSE RAISE EXCEPTION 'invalid_operation'; END IF;
 INSERT INTO p2g_clock_history(organization_id,actor_id,action,reason,before_data,after_data)
 VALUES(_org,_actor,'tag_'||op,_input->>'reason',prior,to_jsonb(t)-'token_hash'-'aes_key'-'uid_hex');
 RETURN to_jsonb(t)-'organization_id'-'token_hash'-'aes_key'-'uid_hex';
 END $$;

CREATE FUNCTION public.p2g_clock_worker(_action text,_input jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DECLARE s record; ev record; local_now timestamp:=now() AT TIME ZONE 'Europe/Lisbon'; day date:=(now() AT TIME ZONE 'Europe/Lisbon')::date;
 key text; result jsonb; job p2g_clock_jobs; lease timestamptz;
 BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_only'; END IF;
 IF _action='enqueue_reminders' THEN
  FOR s IN SELECT w.* FROM p2g_clock_schedules w WHERE w.enabled AND p2g_clock_private.member(w.organization_id,w.user_id) AND extract(isodow FROM day)::integer=ANY(w.weekdays)
  AND NOT EXISTS(SELECT 1 FROM rh_holidays h WHERE h.organization_id=w.organization_id AND h.date=day)
  AND NOT EXISTS(SELECT 1 FROM rh_absences a WHERE a.organization_id=w.organization_id AND a.user_id=w.user_id AND a.status IN ('approved','partially_approved') AND ((a.status='approved' AND day BETWEEN a.start_date AND a.end_date AND NOT EXISTS(SELECT 1 FROM rh_absence_periods ap WHERE ap.absence_id=a.id)) OR EXISTS(SELECT 1 FROM rh_absence_periods ap WHERE ap.absence_id=a.id AND ap.status='approved' AND day BETWEEN ap.start_date AND ap.end_date))) LOOP
   FOR ev IN SELECT * FROM (VALUES('start',s.start_time,s.lunch_time,'Já registou a entrada?'),('pause',s.lunch_time,s.return_time,'Já registou o almoço?'),('resume',s.return_time,s.end_time,'Já registou o regresso?'),('stop',s.end_time,'23:59:59'::time,'Já registou a saída?')) AS events(action,due,until_time,title) LOOP
    IF local_now>=day+ev.due+make_interval(mins=>s.tolerance_minutes) AND local_now<day+ev.until_time
    AND NOT EXISTS(SELECT 1 FROM p2g_clock_entries e WHERE e.organization_id=s.organization_id AND e.user_id=s.user_id AND e.status<>'voided' AND (e.punched_at AT TIME ZONE 'Europe/Lisbon')::date=day AND e.action=ev.action AND (ev.action NOT IN ('pause','resume') OR (e.punched_at AT TIME ZONE 'Europe/Lisbon')::time>=CASE WHEN ev.action='pause' THEN s.lunch_time-interval '1 hour' ELSE s.return_time-interval '1 hour' END)) THEN
     key:='reminder:'||day||':'||ev.action;
     INSERT INTO p2g_clock_jobs(organization_id,user_id,channel,event_key,title,body,payload)
     SELECT s.organization_id,s.user_id,c,key,ev.title,'Abra o relógio de ponto para registar.',jsonb_build_object('action',ev.action) FROM unnest(ARRAY['notification','push']) c ON CONFLICT DO NOTHING;
    END IF;
   END LOOP;
  END LOOP;
  RETURN jsonb_build_object('queued',true);
 ELSIF _action='claim' THEN
  WITH claimed AS (SELECT id FROM p2g_clock_jobs WHERE p2g_clock_private.member(organization_id,user_id) AND attempts<5 AND (state IN ('queued','failed') OR (state='processing' AND claimed_at<now()-interval '10 minutes')) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT least(100,greatest(1,coalesce((_input->>'limit')::integer,50)))),
  updated AS (UPDATE p2g_clock_jobs j SET state='processing',claimed_at=now(),attempts=attempts+1 FROM claimed c WHERE j.id=c.id RETURNING j.*)
  SELECT coalesce(jsonb_agg(to_jsonb(updated)),'[]') INTO result FROM updated; RETURN result;
 ELSIF _action='complete' THEN
  SELECT * INTO job FROM p2g_clock_jobs WHERE id=(_input->>'id')::uuid FOR UPDATE;
  IF job.id IS NULL OR job.state<>'processing' OR job.claimed_at IS DISTINCT FROM (_input->>'claimed_at')::timestamptz THEN RAISE EXCEPTION 'job_not_claimed'; END IF;
  IF (_input->>'success')::boolean AND job.channel='notification' THEN
   INSERT INTO p2g_clock_notifications(organization_id,user_id,event_key,title,body) VALUES(job.organization_id,job.user_id,job.event_key,job.title,job.body) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE p2g_clock_jobs SET state=CASE WHEN (_input->>'success')::boolean THEN 'delivered' ELSE 'failed' END,delivered_at=CASE WHEN (_input->>'success')::boolean THEN now() END,last_error=left(_input->>'error',1000) WHERE id=job.id;
  RETURN jsonb_build_object('ok',true);
 END IF;
 RAISE EXCEPTION 'invalid_action';
 END $$;

CREATE FUNCTION public.p2g_clock_attempt(_org uuid,_user uuid,_input jsonb,_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_only'; END IF;
 IF NOT p2g_clock_private.member(_org,_user) THEN RAISE EXCEPTION 'membership_required'; END IF;
 INSERT INTO p2g_clock_attempts(organization_id,user_id,request_id,reason,input)
 VALUES(_org,_user,(_input->>'request_id')::uuid,_reason,jsonb_build_object('request_id',_input->'request_id','action',_input->'action','device_id',left(_input->>'device_id',200),'position',_input->'position','tag',CASE WHEN _input ? 'tag' THEN jsonb_build_object('id',_input#>'{tag,id}','counter',_input#>'{tag,counter}') END)) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true);
 END $$;
CREATE TRIGGER p2g_clock_attempts_immutable BEFORE UPDATE OR DELETE ON public.p2g_clock_attempts FOR EACH ROW EXECUTE FUNCTION p2g_clock_private.immutable();
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname LIKE 'p2g_clock%') OR n.nspname='p2g_clock_private' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.p2g_clock(text,jsonb),public.p2g_clock_member(uuid,uuid),public.p2g_clock_can(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.p2g_clock_attempt(uuid,uuid,jsonb,text),public.p2g_clock_register(uuid,uuid,jsonb,jsonb),public.p2g_clock_context(uuid,uuid,uuid),public.p2g_clock_tag_manage(uuid,uuid,jsonb),public.p2g_clock_worker(text,jsonb) TO service_role;
