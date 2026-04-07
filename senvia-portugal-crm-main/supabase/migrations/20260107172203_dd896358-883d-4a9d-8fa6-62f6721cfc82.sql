-- Function to check if slug is available
CREATE OR REPLACE FUNCTION public.is_slug_available(_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = _slug
  )
$$;

-- Update create_organization_for_current_user to validate slug
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
  
  -- Check if user is authenticated
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user already has an organization
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND organization_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;
  
  -- Check if slug is available
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = _slug) THEN
    RAISE EXCEPTION 'Slug already exists';
  END IF;
  
  -- Create the organization
  INSERT INTO public.organizations (name, slug)
  VALUES (_name, _slug)
  RETURNING id INTO _org_id;
  
  -- Update user profile with organization
  UPDATE public.profiles
  SET organization_id = _org_id
  WHERE id = _user_id;
  
  -- Assign admin role to user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN _org_id;
END;
$function$;