
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to call process-automation edge function
CREATE OR REPLACE FUNCTION public.notify_automation_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _trigger_type text;
  _org_id uuid;
  _payload jsonb;
  _supabase_url text;
  _anon_key text;
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
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'proposals' THEN
    _org_id := NEW.organization_id;
    IF TG_OP = 'INSERT' THEN
      _trigger_type := 'proposal_created';
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
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-automation',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the original operation if automation fails
  RAISE WARNING 'Automation trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Triggers on leads
CREATE TRIGGER automation_leads_insert
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_trigger();

CREATE TRIGGER automation_leads_update
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_trigger();

-- Triggers on crm_clients
CREATE TRIGGER automation_clients_insert
  AFTER INSERT ON public.crm_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_trigger();

CREATE TRIGGER automation_clients_update
  AFTER UPDATE ON public.crm_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_trigger();

-- Triggers on sales
CREATE TRIGGER automation_sales_insert
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_trigger();

-- Triggers on proposals
CREATE TRIGGER automation_proposals_insert
  AFTER INSERT ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_automation_trigger();
