BEGIN;
CREATE SCHEMA IF NOT EXISTS p2g_release_private;
REVOKE ALL ON SCHEMA p2g_release_private FROM PUBLIC,anon,authenticated;
CREATE TABLE public.p2g_release_settings (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
 messages boolean NOT NULL DEFAULT false,timeclock boolean NOT NULL DEFAULT false,new_ui boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid
);
CREATE TABLE public.p2g_release_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),
 actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),before_data jsonb NOT NULL,after_data jsonb NOT NULL
);
ALTER TABLE public.p2g_release_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2g_release_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.p2g_release_settings,public.p2g_release_audit FROM anon,authenticated;
GRANT ALL ON public.p2g_release_settings,public.p2g_release_audit TO service_role;
CREATE FUNCTION p2g_release_private.admin(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.is_active) AND
 (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','super_admin')) OR EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organization_profiles p ON p.id=m.profile_id AND p.organization_id=m.organization_id WHERE m.organization_id=org AND m.user_id=auth.uid() AND m.is_active AND p.base_role::text='admin'));
$$;
CREATE FUNCTION public.p2g_release(action text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid:=(payload->>'org')::uuid; flags public.p2g_release_settings; previous jsonb; manager boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.p2g_mfa_ok() OR NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=org AND user_id=auth.uid() AND is_active) THEN RAISE EXCEPTION 'access_denied'; END IF;
 manager:=p2g_release_private.admin(org);
 IF action='update' THEN
  IF NOT manager THEN RAISE EXCEPTION 'administrator_required'; END IF;
  IF jsonb_typeof(payload->'messages') IS DISTINCT FROM 'boolean' OR jsonb_typeof(payload->'timeclock') IS DISTINCT FROM 'boolean' OR jsonb_typeof(payload->'new_ui') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_flags'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('p2g-release:'||org::text,0));
  SELECT to_jsonb(s) INTO previous FROM public.p2g_release_settings s WHERE organization_id=org FOR UPDATE;
  INSERT INTO public.p2g_release_settings(organization_id,messages,timeclock,new_ui,updated_by)
  VALUES(org,(payload->>'messages')::boolean,(payload->>'timeclock')::boolean,(payload->>'new_ui')::boolean,auth.uid())
  ON CONFLICT(organization_id) DO UPDATE SET messages=excluded.messages,timeclock=excluded.timeclock,new_ui=excluded.new_ui,updated_by=excluded.updated_by,updated_at=now() RETURNING * INTO flags;
  INSERT INTO public.p2g_release_audit(organization_id,actor_id,before_data,after_data) VALUES(org,auth.uid(),coalesce(previous,'{}'),to_jsonb(flags));
 ELSIF action='snapshot' THEN SELECT * INTO flags FROM public.p2g_release_settings WHERE organization_id=org;
 ELSE RAISE EXCEPTION 'invalid_action'; END IF;
 RETURN jsonb_build_object('messages',coalesce(flags.messages,false),'timeclock',coalesce(flags.timeclock,false),'new_ui',coalesce(flags.new_ui,false),'can_manage',manager);
END $$;
CREATE FUNCTION p2g_release_private.enabled(org uuid,feature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT CASE feature WHEN 'messages' THEN messages WHEN 'timeclock' THEN timeclock WHEN 'new_ui' THEN new_ui ELSE false END FROM public.p2g_release_settings WHERE organization_id=org),false);
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA p2g_release_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.p2g_release(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.p2g_release(text,jsonb) TO authenticated;
COMMENT ON TABLE public.p2g_release_settings IS 'Reversible feature rollout. Disabling flags never deletes messages, attachments or attendance records.';


GRANT USAGE ON SCHEMA p2g_release_private TO service_role;
GRANT EXECUTE ON FUNCTION p2g_release_private.enabled(uuid,text) TO service_role;
ALTER FUNCTION public.p2g_chat(text,jsonb) SET SCHEMA p2g_chat_private;
ALTER FUNCTION p2g_chat_private.p2g_chat(text,jsonb) RENAME TO dispatch;
REVOKE ALL ON FUNCTION p2g_chat_private.dispatch(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.p2g_chat(action text,payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; BEGIN
 IF action IN ('snapshot','search','create','saved') THEN org:=(payload->>'org')::uuid;
 ELSIF action IN ('edit','delete','react','save','pin_message') THEN SELECT c.organization_id INTO org FROM public.p2g_chat_messages m JOIN public.p2g_chat_conversations c ON c.id=m.conversation_id WHERE m.id=(payload->>'message')::uuid;
 ELSE SELECT organization_id INTO org FROM public.p2g_chat_conversations WHERE id=(payload->>'conversation')::uuid; END IF;
 IF NOT p2g_release_private.enabled(org,'messages') THEN RAISE EXCEPTION 'module_disabled'; END IF;
 RETURN p2g_chat_private.dispatch(action,payload);
END $$;
ALTER FUNCTION public.p2g_clock(text,jsonb) SET SCHEMA p2g_clock_private;
ALTER FUNCTION p2g_clock_private.p2g_clock(text,jsonb) RENAME TO dispatch;
REVOKE ALL ON FUNCTION p2g_clock_private.dispatch(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.p2g_clock(action text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT p2g_release_private.enabled((payload->>'org')::uuid,'timeclock') THEN RAISE EXCEPTION 'module_disabled'; END IF;
 RETURN p2g_clock_private.dispatch(action,payload);
END $$;
ALTER FUNCTION public.p2g_clock_register(uuid,uuid,jsonb,jsonb) SET SCHEMA p2g_clock_private;
REVOKE ALL ON FUNCTION p2g_clock_private.p2g_clock_register(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.p2g_clock_register(_org uuid,_user uuid,_input jsonb,_decision jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT p2g_release_private.enabled(_org,'timeclock') THEN RAISE EXCEPTION 'module_disabled'; END IF;
 RETURN p2g_clock_private.p2g_clock_register(_org,_user,_input,_decision);
END $$;
ALTER FUNCTION public.p2g_clock_tag_manage(uuid,uuid,jsonb) SET SCHEMA p2g_clock_private;
REVOKE ALL ON FUNCTION p2g_clock_private.p2g_clock_tag_manage(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.p2g_clock_tag_manage(_org uuid,_actor uuid,_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT p2g_release_private.enabled(_org,'timeclock') THEN RAISE EXCEPTION 'module_disabled'; END IF;
 RETURN p2g_clock_private.p2g_clock_tag_manage(_org,_actor,_input);
END $$;
REVOKE ALL ON FUNCTION public.p2g_chat(text,jsonb),public.p2g_clock(text,jsonb),public.p2g_clock_register(uuid,uuid,jsonb,jsonb),public.p2g_clock_tag_manage(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.p2g_chat(text,jsonb),public.p2g_clock(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.p2g_clock_register(uuid,uuid,jsonb,jsonb),public.p2g_clock_tag_manage(uuid,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.p2g_chat_take_work() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pushes jsonb; files jsonb;
BEGIN
 WITH picked AS (SELECT id FROM public.p2g_chat_push_jobs WHERE p2g_release_private.enabled(organization_id,'messages') AND delivered_at IS NULL AND next_attempt_at<=now() AND (locked_until IS NULL OR locked_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 15),
 claimed AS (UPDATE public.p2g_chat_push_jobs j SET locked_until=now()+interval '10 minutes',attempts=attempts+1 FROM picked p WHERE p.id=j.id RETURNING j.*)
 SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) INTO pushes FROM claimed;
 WITH picked AS (SELECT path FROM public.p2g_chat_file_cleanup WHERE completed_at IS NULL AND next_attempt_at<=now() AND (locked_until IS NULL OR locked_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 30),
 claimed AS (UPDATE public.p2g_chat_file_cleanup j SET locked_until=now()+interval '10 minutes',attempts=attempts+1 FROM picked p WHERE p.path=j.path RETURNING j.*)
 SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) INTO files FROM claimed;
 RETURN jsonb_build_object('push',pushes,'cleanup',files);
END $$;
CREATE OR REPLACE FUNCTION public.p2g_clock_worker(_action text,_input jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DECLARE s record; ev record; local_now timestamp:=now() AT TIME ZONE 'Europe/Lisbon'; day date:=(now() AT TIME ZONE 'Europe/Lisbon')::date;
 key text; result jsonb; job p2g_clock_jobs; lease timestamptz;
 BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_only'; END IF;
 IF _action='enqueue_reminders' THEN
  FOR s IN SELECT w.* FROM p2g_clock_schedules w WHERE p2g_release_private.enabled(w.organization_id,'timeclock') AND w.enabled AND p2g_clock_private.member(w.organization_id,w.user_id) AND extract(isodow FROM day)::integer=ANY(w.weekdays)
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
  WITH claimed AS (SELECT id FROM p2g_clock_jobs WHERE p2g_release_private.enabled(organization_id,'timeclock') AND p2g_clock_private.member(organization_id,user_id) AND attempts<5 AND (state IN ('queued','failed') OR (state='processing' AND claimed_at<now()-interval '10 minutes')) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT least(100,greatest(1,coalesce((_input->>'limit')::integer,50)))),
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


NOTIFY pgrst,'reload schema';
COMMIT;
