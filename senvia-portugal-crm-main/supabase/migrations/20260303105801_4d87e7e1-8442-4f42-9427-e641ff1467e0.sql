
CREATE OR REPLACE FUNCTION public.notify_automation_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _trigger_type text;
  _org_id uuid;
  _payload jsonb;
BEGIN
  -- Determine trigger type and org_id
  IF TG_TABLE_NAME = 'leads' THEN
    _org_id := NEW.organization_id;
    IF TG_OP = 'INSERT' THEN
      _trigger_type := 'lead_created';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      _trigger_type := 'lead_status_changed';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'crm_clients' THEN
    _org_id := NEW.organization_id;
    IF TG_OP = 'INSERT' THEN
      _trigger_type := 'client_created';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      _trigger_type := 'client_status_changed';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'sales' THEN
    _org_id := NEW.organization_id;
    IF TG_OP = 'INSERT' THEN
      _trigger_type := 'sale_created';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      _trigger_type := 'sale_status_changed';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'proposals' THEN
    _org_id := NEW.organization_id;
    IF TG_OP = 'INSERT' THEN
      _trigger_type := 'proposal_created';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      _trigger_type := 'proposal_status_changed';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Build payload
  _payload := jsonb_build_object(
    'trigger_type', _trigger_type,
    'organization_id', _org_id,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  -- Call edge function via pg_net
  PERFORM net.http_post(
    url := 'https://zppcobirzgpfcrnxznwe.supabase.co/functions/v1/process-automation',
    body := _payload,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcGNvYmlyemdwZmNybnh6bndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDIxNDEsImV4cCI6MjA4MzM3ODE0MX0.wn6rMm8gOMJMgnB0jBStpcj5WlybmvauH_th3dcYTuw"}'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Automation trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Ensure the trigger on sales also fires on UPDATE (not just INSERT)
DROP TRIGGER IF EXISTS trigger_automation_sales ON public.sales;
CREATE TRIGGER trigger_automation_sales
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.notify_automation_trigger();

-- Ensure the trigger on proposals also fires on UPDATE (not just INSERT)
DROP TRIGGER IF EXISTS trigger_automation_proposals ON public.proposals;
CREATE TRIGGER trigger_automation_proposals
  AFTER INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_automation_trigger();
