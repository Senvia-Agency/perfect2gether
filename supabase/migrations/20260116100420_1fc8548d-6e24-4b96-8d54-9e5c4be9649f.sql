-- Update create_organization_for_current_user to also add to organization_members
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
  
  -- Add user to organization_members
  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (_user_id, _org_id, 'admin')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN _org_id;
END;
$$;

-- Update accept_invite to also add to organization_members
CREATE OR REPLACE FUNCTION public.accept_invite(_token uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Get the invite
  SELECT * INTO invite_record
  FROM public.organization_invites
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update user profile with organization
  UPDATE public.profiles
  SET organization_id = invite_record.organization_id
  WHERE id = _user_id;

  -- Add role to user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, invite_record.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Add to organization_members
  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (_user_id, invite_record.organization_id, invite_record.role)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = invite_record.role;

  -- Mark invite as accepted
  UPDATE public.organization_invites
  SET status = 'accepted'
  WHERE id = invite_record.id;

  RETURN TRUE;
END;
$$;