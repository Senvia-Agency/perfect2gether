-- Additive storage; legacy refused proposals are not modified.
ALTER TABLE public.calendar_events ADD COLUMN proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD COLUMN rejection_reason text;
ALTER TABLE public.proposals ADD COLUMN rejection_meeting_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL;

CREATE FUNCTION public.require_p2g_rejection_meeting()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NEW.organization_id='96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid AND NEW.status='rejected' THEN
   IF TG_OP='UPDATE' THEN
     IF OLD.status='rejected' THEN RETURN NEW; END IF;
   END IF;
   IF nullif(btrim(NEW.rejection_reason),'') IS NULL OR NOT EXISTS (
     SELECT 1 FROM public.calendar_events e WHERE e.id=NEW.rejection_meeting_id
       AND e.organization_id=NEW.organization_id AND e.proposal_id=NEW.id
       AND e.event_type='meeting' AND e.status='pending' AND e.start_time>now()
       AND e.end_time>e.start_time
       AND e.client_id IS NOT DISTINCT FROM NEW.client_id
       AND e.lead_id IS NOT DISTINCT FROM NEW.lead_id
   ) THEN RAISE EXCEPTION 'Indique o motivo da recusa e marque uma reunião de acompanhamento'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_p2g_rejection_meeting() FROM PUBLIC;
CREATE TRIGGER require_p2g_rejection_meeting BEFORE INSERT OR UPDATE OF status ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.require_p2g_rejection_meeting();

CREATE FUNCTION public.reject_p2g_proposal_with_meeting(_proposal uuid, _reason text, _meeting jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.proposals; meeting_id uuid; starts timestamptz; ends timestamptz; reason text:=btrim(_reason);
BEGIN
 IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' OR NOT public.p2g_mfa_ok() THEN
   RAISE EXCEPTION 'Sessão autorizada necessária';
 END IF;
 IF reason IS NULL OR reason='' THEN RAISE EXCEPTION 'Indique o motivo da recusa'; END IF;
 starts:=(_meeting->>'start_time')::timestamptz; ends:=(_meeting->>'end_time')::timestamptz;
 IF starts IS NULL OR ends IS NULL OR starts<=now() OR ends<=starts THEN
   RAISE EXCEPTION 'Marque uma reunião futura com início e fim válidos';
 END IF;
 SELECT * INTO p FROM public.proposals WHERE id=_proposal FOR UPDATE;
 IF NOT FOUND OR p.organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid THEN
   RAISE EXCEPTION 'Proposta indisponível';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id=auth.uid()
   AND m.organization_id=p.organization_id AND m.is_active) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 IF p.status='accepted' THEN RAISE EXCEPTION 'Uma proposta aceite não pode ser recusada'; END IF;
 -- A retry after a lost response must not create another meeting.
 IF p.status='rejected' AND p.rejection_meeting_id IS NOT NULL THEN
   IF p.rejection_reason=reason AND EXISTS (SELECT 1 FROM public.calendar_events e
     WHERE e.id=p.rejection_meeting_id AND e.start_time=starts AND e.end_time=ends) THEN
     RETURN p.rejection_meeting_id;
   END IF;
   RAISE EXCEPTION 'Esta proposta já foi recusada e tem uma reunião marcada';
 END IF;
 INSERT INTO public.calendar_events(organization_id,user_id,proposal_id,client_id,lead_id,title,description,
   event_type,start_time,end_time,status,meeting_link)
 VALUES(p.organization_id,auth.uid(),p.id,p.client_id,p.lead_id,
   'Acompanhamento da proposta '||coalesce(p.code,p.id::text),'Motivo da recusa: '||reason,
   'meeting',starts,ends,'pending',nullif(btrim(_meeting->>'meeting_link'),'')) RETURNING id INTO meeting_id;
 UPDATE public.proposals SET status='rejected',rejection_reason=reason,rejection_meeting_id=meeting_id WHERE id=p.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível guardar a recusa'; END IF;
 IF p.lead_id IS NOT NULL AND nullif(_meeting->>'lead_status','') IS NOT NULL THEN
   UPDATE public.leads SET status=_meeting->>'lead_status' WHERE id=p.lead_id AND organization_id=p.organization_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível atualizar a lead associada'; END IF;
 END IF;
 RETURN meeting_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_p2g_proposal_with_meeting(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_p2g_proposal_with_meeting(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
