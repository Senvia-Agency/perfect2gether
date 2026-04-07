
-- Migrate members from old non-system lists to the new system lists and remove old duplicates
DO $$
DECLARE
  org record;
  old_list_id uuid;
  new_list_id uuid;
BEGIN
  FOR org IN SELECT DISTINCT organization_id FROM client_lists WHERE is_system = true LOOP
    -- Migrate "Clientes" members
    SELECT id INTO old_list_id FROM client_lists 
      WHERE organization_id = org.organization_id AND name = 'Clientes' AND is_system = false LIMIT 1;
    SELECT id INTO new_list_id FROM client_lists 
      WHERE organization_id = org.organization_id AND name = 'Clientes' AND is_system = true LIMIT 1;
    IF old_list_id IS NOT NULL AND new_list_id IS NOT NULL THEN
      INSERT INTO marketing_list_members (list_id, contact_id)
      SELECT new_list_id, contact_id FROM marketing_list_members WHERE list_id = old_list_id
      ON CONFLICT (list_id, contact_id) DO NOTHING;
      DELETE FROM marketing_list_members WHERE list_id = old_list_id;
      DELETE FROM client_lists WHERE id = old_list_id;
    END IF;

    -- Migrate "Leads Não Convertidas" members
    SELECT id INTO old_list_id FROM client_lists 
      WHERE organization_id = org.organization_id AND name = 'Leads Não Convertidas' AND is_system = false LIMIT 1;
    SELECT id INTO new_list_id FROM client_lists 
      WHERE organization_id = org.organization_id AND name = 'Leads Não Convertidas' AND is_system = true LIMIT 1;
    IF old_list_id IS NOT NULL AND new_list_id IS NOT NULL THEN
      INSERT INTO marketing_list_members (list_id, contact_id)
      SELECT new_list_id, contact_id FROM marketing_list_members WHERE list_id = old_list_id
      ON CONFLICT (list_id, contact_id) DO NOTHING;
      DELETE FROM marketing_list_members WHERE list_id = old_list_id;
      DELETE FROM client_lists WHERE id = old_list_id;
    END IF;
  END LOOP;
END;
$$;

-- Update sync_client_to_marketing to use system list
CREATE OR REPLACE FUNCTION public.sync_client_to_marketing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contact_id uuid;
  _list_id uuid;
  _contact_email text;
BEGIN
  _contact_email := COALESCE(NULLIF(TRIM(NEW.email), ''), 'client-' || NEW.id || '@placeholder.local');

  INSERT INTO marketing_contacts (organization_id, name, email, phone, company, source, subscribed)
  VALUES (NEW.organization_id, NEW.name, _contact_email, NEW.phone, NEW.company, 'crm_client', true)
  ON CONFLICT (organization_id, email) DO UPDATE
    SET name = EXCLUDED.name, phone = EXCLUDED.phone, company = EXCLUDED.company, updated_at = now()
  RETURNING id INTO _contact_id;

  -- Use the system "Clientes" list
  SELECT id INTO _list_id FROM client_lists
    WHERE organization_id = NEW.organization_id AND name = 'Clientes' AND is_system = true LIMIT 1;

  IF _list_id IS NULL THEN
    -- Ensure auto-lists exist
    PERFORM ensure_org_auto_lists(NEW.organization_id);
    SELECT id INTO _list_id FROM client_lists
      WHERE organization_id = NEW.organization_id AND name = 'Clientes' AND is_system = true LIMIT 1;
  END IF;

  IF _list_id IS NOT NULL AND _contact_id IS NOT NULL THEN
    INSERT INTO marketing_list_members (list_id, contact_id)
    VALUES (_list_id, _contact_id)
    ON CONFLICT (list_id, contact_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the old sync_lead_to_marketing function (replaced by sync_lead_to_auto_lists)
DROP FUNCTION IF EXISTS public.sync_lead_to_marketing() CASCADE;
