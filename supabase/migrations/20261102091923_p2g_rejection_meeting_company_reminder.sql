CREATE FUNCTION public.prepare_p2g_proposal_meeting()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE company_name text; company_nif text;
BEGIN
  IF NEW.organization_id <> '96a3950e-31be-4c6d-abed-b82968c0d7e9'::uuid
    OR NEW.proposal_id IS NULL OR NEW.event_type <> 'meeting' THEN
    RETURN NEW;
  END IF;
  IF NEW.reminder_minutes IS NULL OR NEW.reminder_minutes < 0 THEN
    NEW.reminder_minutes := 15;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT coalesce(nullif(btrim(c.company),''),nullif(btrim(c.name),''),
                    nullif(btrim(l.company_name),''),nullif(btrim(l.name),'')),
           coalesce(nullif(btrim(c.company_nif),''),nullif(btrim(c.nif),''),nullif(btrim(l.company_nif),''))
    INTO company_name, company_nif
    FROM public.proposals p
    LEFT JOIN public.crm_clients c ON c.id=p.client_id AND c.organization_id=p.organization_id
    LEFT JOIN public.leads l ON l.id=p.lead_id AND l.organization_id=p.organization_id
    WHERE p.id=NEW.proposal_id AND p.organization_id=NEW.organization_id
      AND p.client_id IS NOT DISTINCT FROM NEW.client_id
      AND p.lead_id IS NOT DISTINCT FROM NEW.lead_id;
    IF company_name IS NOT NULL THEN
      NEW.title := NEW.title || ' — ' || company_name;
    END IF;
    NEW.description := concat_ws(E'\n',
      CASE WHEN company_name IS NOT NULL THEN 'Empresa: ' || company_name END,
      CASE WHEN company_nif IS NOT NULL THEN 'NIF: ' || company_nif END,
      NEW.description);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_p2g_proposal_meeting() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prepare_p2g_proposal_meeting
BEFORE INSERT OR UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.prepare_p2g_proposal_meeting();
