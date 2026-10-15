-- Preserve existing rows and permissions; enforce new P2G CPE identities.
CREATE FUNCTION public.p2g_assert_unique_cpe()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cpe text; fiscal_nif text; identity_key text;
BEGIN
 IF NEW.organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
   OR lower(btrim(NEW.equipment_type)) IN ('serviços','servicos') THEN RETURN NEW; END IF;
 cpe:=upper(regexp_replace(coalesce(NEW.serial_number,''),'[[:space:]]','','g'));
 IF cpe='' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.organization_id=OLD.organization_id AND NEW.client_id=OLD.client_id
     AND NEW.equipment_type IS NOT DISTINCT FROM OLD.equipment_type
     AND cpe=upper(regexp_replace(coalesce(OLD.serial_number,''),'[[:space:]]','','g')) THEN
     RETURN NEW;
   END IF;
 END IF;
 SELECT coalesce(nullif(regexp_replace(c.company_nif,'[[:space:]]','','g'),''),
   nullif(regexp_replace(c.nif,'[[:space:]]','','g'),'')) INTO fiscal_nif
 FROM public.crm_clients c WHERE c.id=NEW.client_id AND c.organization_id=NEW.organization_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente indisponível'; END IF;
 identity_key:=coalesce(fiscal_nif,'client:'||NEW.client_id::text);
 -- Serialize concurrent creates of the same org/NIF/CPE before checking.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.organization_id::text||':'||identity_key||':'||cpe,0));
 IF EXISTS (
   SELECT 1 FROM public.cpes e JOIN public.crm_clients c ON c.id=e.client_id AND c.organization_id=e.organization_id
   WHERE e.organization_id=NEW.organization_id AND e.id<>NEW.id
     AND lower(btrim(e.equipment_type)) NOT IN ('serviços','servicos')
     AND upper(regexp_replace(coalesce(e.serial_number,''),'[[:space:]]','','g'))=cpe
     AND (CASE WHEN fiscal_nif IS NULL THEN c.id=NEW.client_id ELSE
       coalesce(nullif(regexp_replace(c.company_nif,'[[:space:]]','','g'),''),
       nullif(regexp_replace(c.nif,'[[:space:]]','','g'),''))=fiscal_nif END)
 ) THEN
   RAISE EXCEPTION 'Este CPE já existe para este NIF.' USING ERRCODE='23505',CONSTRAINT='p2g_cpes_nif_serial_unique';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.p2g_assert_unique_cpe() FROM PUBLIC;
CREATE TRIGGER p2g_cpe_nif_duplicates BEFORE INSERT OR UPDATE OF serial_number,client_id,organization_id,equipment_type
ON public.cpes FOR EACH ROW EXECUTE FUNCTION public.p2g_assert_unique_cpe();
CREATE INDEX p2g_cpes_serial_lookup ON public.cpes(organization_id,upper(regexp_replace(coalesce(serial_number,''),'[[:space:]]','','g')))
WHERE organization_id='96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid;
NOTIFY pgrst, 'reload schema';
