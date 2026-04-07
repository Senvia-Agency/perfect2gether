
-- Drop the partial unique index and create a full unique index
DROP INDEX IF EXISTS idx_marketing_contacts_org_email;
CREATE UNIQUE INDEX idx_marketing_contacts_org_email ON public.marketing_contacts (organization_id, email);

-- ============================================================
-- Função: sync_client_to_marketing
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_client_to_marketing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  SELECT id INTO _list_id FROM client_lists
  WHERE organization_id = NEW.organization_id AND name = 'Clientes' LIMIT 1;

  IF _list_id IS NULL THEN
    INSERT INTO client_lists (organization_id, name, description)
    VALUES (NEW.organization_id, 'Clientes', 'Lista automática de clientes CRM')
    RETURNING id INTO _list_id;
  END IF;

  INSERT INTO marketing_list_members (list_id, contact_id)
  VALUES (_list_id, _contact_id)
  ON CONFLICT (list_id, contact_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Função: sync_lead_to_marketing
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_lead_to_marketing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _contact_id uuid;
  _list_id uuid;
  _contact_email text;
BEGIN
  _contact_email := COALESCE(NULLIF(TRIM(NEW.email), ''), 'lead-' || NEW.id || '@placeholder.local');

  IF NEW.status IS DISTINCT FROM 'won' THEN
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
$$;

-- ============================================================
-- Seed: sincronizar dados existentes
-- ============================================================
DO $$
DECLARE
  r RECORD;
  _contact_id uuid;
  _list_id uuid;
  _email text;
BEGIN
  FOR r IN SELECT * FROM crm_clients LOOP
    _email := COALESCE(NULLIF(TRIM(r.email), ''), 'client-' || r.id || '@placeholder.local');

    INSERT INTO marketing_contacts (organization_id, name, email, phone, company, source, subscribed)
    VALUES (r.organization_id, r.name, _email, r.phone, r.company, 'crm_client', true)
    ON CONFLICT (organization_id, email) DO UPDATE
      SET name = EXCLUDED.name, phone = EXCLUDED.phone, company = EXCLUDED.company, updated_at = now()
    RETURNING id INTO _contact_id;

    SELECT id INTO _list_id FROM client_lists
    WHERE organization_id = r.organization_id AND name = 'Clientes' LIMIT 1;
    IF _list_id IS NULL THEN
      INSERT INTO client_lists (organization_id, name, description)
      VALUES (r.organization_id, 'Clientes', 'Lista automática de clientes CRM')
      RETURNING id INTO _list_id;
    END IF;

    INSERT INTO marketing_list_members (list_id, contact_id)
    VALUES (_list_id, _contact_id) ON CONFLICT (list_id, contact_id) DO NOTHING;
  END LOOP;

  FOR r IN SELECT * FROM leads WHERE status IS DISTINCT FROM 'won' LOOP
    _email := COALESCE(NULLIF(TRIM(r.email), ''), 'lead-' || r.id || '@placeholder.local');

    INSERT INTO marketing_contacts (organization_id, name, email, phone, source, subscribed)
    VALUES (r.organization_id, r.name, _email, r.phone, 'lead', true)
    ON CONFLICT (organization_id, email) DO UPDATE
      SET name = EXCLUDED.name, phone = EXCLUDED.phone, updated_at = now()
    RETURNING id INTO _contact_id;

    SELECT id INTO _list_id FROM client_lists
    WHERE organization_id = r.organization_id AND name = 'Leads Não Convertidas' LIMIT 1;
    IF _list_id IS NULL THEN
      INSERT INTO client_lists (organization_id, name, description)
      VALUES (r.organization_id, 'Leads Não Convertidas', 'Lista automática de leads não convertidos')
      RETURNING id INTO _list_id;
    END IF;

    INSERT INTO marketing_list_members (list_id, contact_id)
    VALUES (_list_id, _contact_id) ON CONFLICT (list_id, contact_id) DO NOTHING;
  END LOOP;
END;
$$;
