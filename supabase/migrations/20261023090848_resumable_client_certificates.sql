ALTER TABLE public.client_certificate_lookups
 ADD COLUMN checked_at timestamptz,
 ADD COLUMN phase text NOT NULL DEFAULT 'EXTRACTING' CHECK(phase IN ('QUEUED','EXTRACTING'));
CREATE TABLE public.client_certificate_requests (
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 lookup_id uuid NOT NULL REFERENCES public.client_certificate_lookups(id) ON DELETE CASCADE,
 PRIMARY KEY(organization_id,user_id,request_id)
);
ALTER TABLE public.client_certificate_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_certificate_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.client_certificate_requests TO service_role;

CREATE FUNCTION public.reserve_client_certificate(p_org uuid,p_user uuid,p_crc text,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE item public.client_certificate_lookups; launch boolean:=false; reused boolean:=false;
BEGIN
 IF p_org <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR p_crc !~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}$' OR p_request IS NULL THEN RAISE EXCEPTION 'invalid_lookup'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 SELECT l.* INTO item FROM public.client_certificate_requests r JOIN public.client_certificate_lookups l ON l.id=r.lookup_id
 WHERE r.organization_id=p_org AND r.user_id=p_user AND r.request_id=p_request;
 IF FOUND THEN
  IF item.crc_code<>p_crc THEN RAISE EXCEPTION 'request_conflict'; END IF;
  RETURN to_jsonb(item)||jsonb_build_object('launch',false,'cached',item.status='SUCCEEDED');
 END IF;
 SELECT * INTO item FROM public.client_certificate_lookups
 WHERE organization_id=p_org AND user_id=p_user AND crc_code=p_crc
 AND ((status='RUNNING' AND created_at>now()-interval '5 minutes')
 OR (status='SUCCEEDED' AND checked_at>now()-interval '10 minutes'))
 ORDER BY (status='SUCCEEDED') DESC,created_at DESC LIMIT 1;
 reused:=FOUND;
 IF NOT reused THEN
  IF EXISTS(SELECT 1 FROM public.client_certificate_lookups WHERE organization_id=p_org AND created_at>now()-interval '30 seconds')
  OR (SELECT count(*) FROM public.client_certificate_lookups WHERE organization_id=p_org AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'lookup_limit'; END IF;
  INSERT INTO public.client_certificate_lookups(organization_id,user_id,crc_code,phase)
  VALUES(p_org,p_user,p_crc,'QUEUED') RETURNING * INTO item;
  launch:=true;
 END IF;
 INSERT INTO public.client_certificate_requests(organization_id,user_id,request_id,lookup_id) VALUES(p_org,p_user,p_request,item.id);
 RETURN to_jsonb(item)||jsonb_build_object('launch',launch,'cached',reused AND item.status='SUCCEEDED');
END $$;
REVOKE ALL ON FUNCTION public.reserve_client_certificate(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_client_certificate(uuid,uuid,text,uuid) TO service_role;
