CREATE OR REPLACE FUNCTION public.sync_lead_to_marketing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _contact_id uuid;
  _list_id uuid;
  _contact_email text;
  _is_won boolean;
BEGIN
  _contact_email := COALESCE(NULLIF(TRIM(NEW.email), ''), 'lead-' || NEW.id || '@placeholder.local');

  -- Check if the new status corresponds to a "won" (final positive) pipeline stage
  SELECT EXISTS (
    SELECT 1 FROM pipeline_stages
    WHERE organization_id = NEW.organization_id
      AND key = NEW.status
      AND is_final_positive = true
  ) INTO _is_won;

  IF NOT _is_won THEN
    INSERT INTO marketing_contacts (organization_id, name, email, phone, source, subscribed)
    VALUES (NEW.organization_id, NEW.name, _contact_email, NEW.phone, 'lead', true)
    ON CONFLICT (organization_id, email) DO UPDATE
      SET name = EXCLUDED.name, phone = EXCLUDED.phone, updated_at = now()
    RETURNING id INTO _contact_id;

    SELECT id INTO _list_id FROM client_lists
    WHERE organization_id = NEW.organization_id AND name = 'Leads Não Convertidas' LIMIT 1;

    IF _list_id IS NULL THEN
      INSERT INTO client_lists (organization_id, name, description)
      VALUES (NEW.organization_id, 'Leads Não Convertidas', 'Lista automática de leads não convertidos')
      RETURNING id INTO _list_id;
    END IF;

    INSERT INTO marketing_list_members (list_id, contact_id)
    VALUES (_list_id, _contact_id)
    ON CONFLICT (list_id, contact_id) DO NOTHING;
  ELSE
    SELECT id INTO _list_id FROM client_lists
    WHERE organization_id = NEW.organization_id AND name = 'Leads Não Convertidas' LIMIT 1;

    IF _list_id IS NOT NULL THEN
      SELECT id INTO _contact_id FROM marketing_contacts
      WHERE organization_id = NEW.organization_id AND email = _contact_email LIMIT 1;

      IF _contact_id IS NOT NULL THEN
        DELETE FROM marketing_list_members WHERE list_id = _list_id AND contact_id = _contact_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;