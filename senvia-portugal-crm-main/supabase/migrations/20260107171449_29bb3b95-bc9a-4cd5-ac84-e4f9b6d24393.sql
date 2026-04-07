-- Function to create organization for first user (bootstrap)
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
$$;

-- Policy for admins to update their organization (for webhook_url, etc.)
CREATE POLICY "Admins update own organization"
ON public.organizations
FOR UPDATE
USING (id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Policy for users to view their own profile (even without org)
CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
USING (id = auth.uid());