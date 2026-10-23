ALTER TABLE public.crm_clients
 ADD COLUMN crc_code text,
 ADD COLUMN certificate_data jsonb,
 ADD COLUMN certificate_checked_at timestamptz,
 ADD CONSTRAINT crm_clients_crc_format CHECK(crc_code IS NULL OR crc_code ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}$');

CREATE FUNCTION public.check_client_crc() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.organization_id='96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
 AND (NEW.crc_code IS NULL OR NEW.crc_code !~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}$') THEN
  RAISE EXCEPTION 'Código CRC obrigatório (0000-0000-0000)' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_clients_require_crc BEFORE INSERT OR UPDATE OF crc_code,organization_id ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION public.check_client_crc();

-- Provider ids and results are server-only; user-facing ids are opaque UUIDs.
CREATE TABLE public.client_certificate_lookups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 crc_code text NOT NULL,
 provider_run_id text,
 status text NOT NULL DEFAULT 'RUNNING' CHECK(status IN ('RUNNING','SUCCEEDED','FAILED')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_certificate_lookups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_certificate_lookups FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.client_certificate_lookups TO service_role;
CREATE INDEX client_certificate_lookups_org_created ON public.client_certificate_lookups(organization_id,created_at DESC);

-- One atomic reservation per organization each 30 seconds; maximum 100/day.
-- Caller is the authenticated Edge Function, never a browser RPC.
CREATE FUNCTION public.claim_client_certificate_lookup(p_org uuid,p_user uuid,p_crc text) RETURNS uuid
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF p_org <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid OR p_crc !~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}$' THEN RAISE EXCEPTION 'invalid_lookup'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,0));
 IF EXISTS(SELECT 1 FROM public.client_certificate_lookups WHERE organization_id=p_org AND created_at>now()-interval '30 seconds')
 OR (SELECT count(*) FROM public.client_certificate_lookups WHERE organization_id=p_org AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'lookup_limit'; END IF;
 INSERT INTO public.client_certificate_lookups(organization_id,user_id,crc_code) VALUES(p_org,p_user,p_crc) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.claim_client_certificate_lookup(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_client_certificate_lookup(uuid,uuid,text) TO service_role;


