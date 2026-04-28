
-- Update create_organization_for_current_user (P2G: no trial/marketing sync, no SENVIA references)
CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(_name text, _slug text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- SENVIA-specific data seeds removed (ensure_stripe_auto_lists call + backfill DO block)
