
-- Update ensure_stripe_auto_lists to include trial lists
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

-- SENVIA-specific data seed removed (not applicable to Perfect2Gether)

-- Update create_organization_for_current_user (P2G: no trial/marketing sync)
CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(_name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _user_id uuid;
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

  RETURN _org_id;
END;
$$;
