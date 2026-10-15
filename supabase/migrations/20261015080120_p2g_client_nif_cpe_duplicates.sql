-- Share the CPE writer's identity locks when a client's fiscal identity changes.
-- Existing CPEs, grants and RLS policies remain untouched.
CREATE FUNCTION public.p2g_assert_client_nif_cpes()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 fiscal_nif text;
 previous_nif text;
 cpe text;
BEGIN
 IF NEW.organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid THEN RETURN NEW; END IF;
 fiscal_nif:=coalesce(nullif(regexp_replace(NEW.company_nif,'[[:space:]]','','g'),''),
   nullif(regexp_replace(NEW.nif,'[[:space:]]','','g'),''));
 previous_nif:=coalesce(nullif(regexp_replace(OLD.company_nif,'[[:space:]]','','g'),''),
   nullif(regexp_replace(OLD.nif,'[[:space:]]','','g'),''));
 IF fiscal_nif IS NOT DISTINCT FROM previous_nif OR fiscal_nif IS NULL THEN RETURN NEW; END IF;

 -- The client UPDATE row lock conflicts with the CPE writer's FOR SHARE lock.
 -- Sorted identity locks also serialize clients converging on the same NIF/CPE.
 FOR cpe IN
   SELECT DISTINCT upper(regexp_replace(coalesce(e.serial_number,''),'[[:space:]]','','g'))
   FROM public.cpes e
   WHERE e.client_id=NEW.id AND e.organization_id=NEW.organization_id
     AND lower(btrim(e.equipment_type)) NOT IN ('serviços','servicos')
     AND upper(regexp_replace(coalesce(e.serial_number,''),'[[:space:]]','','g'))<>''
   ORDER BY 1
 LOOP
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.organization_id::text||':'||fiscal_nif||':'||cpe,0));
   IF EXISTS (
     SELECT 1 FROM public.cpes e
     JOIN public.crm_clients c ON c.id=e.client_id AND c.organization_id=e.organization_id
     WHERE e.organization_id=NEW.organization_id AND c.id<>NEW.id
       AND lower(btrim(e.equipment_type)) NOT IN ('serviços','servicos')
       AND upper(regexp_replace(coalesce(e.serial_number,''),'[[:space:]]','','g'))=cpe
       AND coalesce(nullif(regexp_replace(c.company_nif,'[[:space:]]','','g'),''),
         nullif(regexp_replace(c.nif,'[[:space:]]','','g'),''))=fiscal_nif
   ) THEN
     RAISE EXCEPTION 'Este CPE já existe para este NIF.' USING ERRCODE='23505',CONSTRAINT='p2g_cpes_nif_serial_unique';
   END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.p2g_assert_client_nif_cpes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER p2g_client_nif_cpe_duplicates BEFORE UPDATE OF company_nif,nif
ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION public.p2g_assert_client_nif_cpes();
NOTIFY pgrst, 'reload schema';

