
-- Add is_system flag to client_lists for auto-managed lists
ALTER TABLE public.client_lists ADD COLUMN is_system boolean NOT NULL DEFAULT false;

-- Add unique constraint on marketing_contacts for upsert by email+org
ALTER TABLE public.marketing_contacts ADD CONSTRAINT marketing_contacts_org_email_unique UNIQUE (organization_id, email);

-- Add unique constraint on marketing_list_members for dedup
ALTER TABLE public.marketing_list_members ADD CONSTRAINT marketing_list_members_list_contact_unique UNIQUE (list_id, contact_id);

-- Function to ensure the 3 auto-lists exist for an org
CREATE OR REPLACE FUNCTION public.ensure_org_auto_lists(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Leads Novos', 'Leads na primeira etapa do pipeline', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Leads Novos' AND is_system = true
  );

  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Clientes', 'Leads convertidos em clientes', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Clientes' AND is_system = true
  );

  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, 'Leads Não Convertidas', 'Leads em etapa final negativa', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists WHERE organization_id = p_org_id AND name = 'Leads Não Convertidas' AND is_system = true
  );
END;
$$;

-- Trigger function: sync leads to auto marketing lists
CREATE OR REPLACE FUNCTION public.sync_lead_to_auto_lists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_list_novos_id uuid;
  v_list_clientes_id uuid;
  v_list_nao_conv_id uuid;
  v_stage record;
  v_first_stage_key text;
BEGIN
  -- Skip leads without email
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  -- Ensure auto-lists exist
  PERFORM ensure_org_auto_lists(NEW.organization_id);

  -- Get list IDs
  SELECT id INTO v_list_novos_id FROM client_lists
    WHERE organization_id = NEW.organization_id AND name = 'Leads Novos' AND is_system = true LIMIT 1;
  SELECT id INTO v_list_clientes_id FROM client_lists
    WHERE organization_id = NEW.organization_id AND name = 'Clientes' AND is_system = true LIMIT 1;
  SELECT id INTO v_list_nao_conv_id FROM client_lists
    WHERE organization_id = NEW.organization_id AND name = 'Leads Não Convertidas' AND is_system = true LIMIT 1;

  -- Upsert marketing contact from lead data
  INSERT INTO marketing_contacts (organization_id, name, email, phone, source)
  VALUES (NEW.organization_id, NEW.name, NEW.email, NEW.phone, COALESCE(NEW.source, 'lead'))
  ON CONFLICT (organization_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, marketing_contacts.phone),
    updated_at = now()
  RETURNING id INTO v_contact_id;

  IF v_contact_id IS NULL THEN
    SELECT id INTO v_contact_id FROM marketing_contacts
      WHERE organization_id = NEW.organization_id AND email = NEW.email LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the first pipeline stage (lowest position = "Novo")
  SELECT key INTO v_first_stage_key FROM pipeline_stages
    WHERE organization_id = NEW.organization_id
    ORDER BY position ASC LIMIT 1;

  -- Get current stage info
  SELECT * INTO v_stage FROM pipeline_stages
    WHERE organization_id = NEW.organization_id AND key = NEW.status LIMIT 1;

  -- Remove from all auto-lists
  DELETE FROM marketing_list_members
    WHERE contact_id = v_contact_id
    AND list_id IN (v_list_novos_id, v_list_clientes_id, v_list_nao_conv_id);

  -- Add to the correct list based on pipeline stage
  IF NEW.status = v_first_stage_key OR v_stage IS NULL THEN
    -- First stage = Leads Novos
    INSERT INTO marketing_list_members (list_id, contact_id)
    VALUES (v_list_novos_id, v_contact_id)
    ON CONFLICT (list_id, contact_id) DO NOTHING;
  ELSIF v_stage.is_final_positive = true THEN
    -- Won = Clientes
    INSERT INTO marketing_list_members (list_id, contact_id)
    VALUES (v_list_clientes_id, v_contact_id)
    ON CONFLICT (list_id, contact_id) DO NOTHING;
  ELSIF v_stage.is_final_negative = true THEN
    -- Lost = Leads Não Convertidas
    INSERT INTO marketing_list_members (list_id, contact_id)
    VALUES (v_list_nao_conv_id, v_contact_id)
    ON CONFLICT (list_id, contact_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on leads table
CREATE TRIGGER trg_lead_auto_lists
AFTER INSERT OR UPDATE OF status ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_to_auto_lists();

-- Seed auto-lists for all existing organizations
DO $$
DECLARE
  org record;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    PERFORM ensure_org_auto_lists(org.id);
  END LOOP;
END;
$$;
