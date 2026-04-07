
-- 1. Update ensure_stripe_auto_lists to include trial lists
CREATE OR REPLACE FUNCTION public.ensure_stripe_auto_lists(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO client_lists (organization_id, name, description, is_dynamic, is_system)
  SELECT p_org_id, v.name, v.description, false, true
  FROM (VALUES
    ('Plano Starter', 'Clientes com subscrição Starter ativa'),
    ('Plano Pro', 'Clientes com subscrição Pro ativa'),
    ('Plano Elite', 'Clientes com subscrição Elite ativa'),
    ('Pagamento em Atraso', 'Clientes com pagamento falhado ou past_due'),
    ('Subscrição Cancelada', 'Clientes que cancelaram a subscrição'),
    ('Clientes em Trial', 'Organizações em período de teste gratuito'),
    ('Trial Expirado', 'Organizações cujo trial expirou sem plano')
  ) AS v(name, description)
  WHERE NOT EXISTS (
    SELECT 1 FROM client_lists cl
    WHERE cl.organization_id = p_org_id AND cl.name = v.name AND cl.is_system = true
  );
END;
$$;

-- Create the 2 new trial lists immediately for Senvia Agency
SELECT ensure_stripe_auto_lists('06fe9e1d-9670-45b0-8717-c5a6e90be380');

-- 2. Update create_organization_for_current_user to dispatch trial_started
CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(_name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _user_id uuid;
  _user_email text;
  _senvia_org_id uuid := '06fe9e1d-9670-45b0-8717-c5a6e90be380';
  _supabase_url text;
  _anon_key text;
  _contact_id uuid;
  _trial_list_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND organization_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Slug already exists';
  END IF;
  
  INSERT INTO public.organizations (name, slug)
  VALUES (_name, _slug)
  RETURNING id INTO _org_id;
  
  UPDATE public.profiles
  SET organization_id = _org_id
  WHERE id = _user_id;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (_user_id, _org_id, 'admin')
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  -- Get user email for trial list sync
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;

  IF _user_email IS NOT NULL THEN
    -- Upsert marketing contact in Senvia Agency
    INSERT INTO public.marketing_contacts (organization_id, email, name, source, subscribed)
    VALUES (_senvia_org_id, _user_email, _name, 'trial', true)
    ON CONFLICT (organization_id, email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO _contact_id;

    -- Add to "Clientes em Trial" list
    SELECT id INTO _trial_list_id FROM public.client_lists
    WHERE organization_id = _senvia_org_id AND name = 'Clientes em Trial' AND is_system = true
    LIMIT 1;

    IF _trial_list_id IS NOT NULL AND _contact_id IS NOT NULL THEN
      INSERT INTO public.marketing_list_members (list_id, contact_id)
      VALUES (_trial_list_id, _contact_id)
      ON CONFLICT (list_id, contact_id) DO NOTHING;
    END IF;

    -- Dispatch trial_started automation via pg_net
    BEGIN
      _supabase_url := current_setting('app.settings.supabase_url', true);
      _anon_key := current_setting('app.settings.anon_key', true);
      
      IF _supabase_url IS NOT NULL AND _anon_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := _supabase_url || '/functions/v1/process-automation',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _anon_key
          ),
          body := jsonb_build_object(
            'trigger_type', 'trial_started',
            'organization_id', _senvia_org_id,
            'record', jsonb_build_object('email', _user_email, 'nome', _name)
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail org creation if automation dispatch fails
      NULL;
    END;
  END IF;
  
  RETURN _org_id;
END;
$$;
