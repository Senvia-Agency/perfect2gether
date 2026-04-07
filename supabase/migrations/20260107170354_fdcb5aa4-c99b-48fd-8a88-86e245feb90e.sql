-- Create organization_invites table
CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  UNIQUE(token),
  UNIQUE(organization_id, email)
);

-- Enable RLS
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "Super admin full access invites"
ON public.organization_invites FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Org admins: can manage invites for their organization
CREATE POLICY "Org admins manage invites"
ON public.organization_invites FOR ALL
TO authenticated
USING (
  organization_id = get_user_org_id(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Public read by token for registration validation
CREATE POLICY "Anyone can read pending invite by token"
ON public.organization_invites FOR SELECT
TO anon, authenticated
USING (status = 'pending' AND expires_at > now());

-- Function to accept invite and update user
CREATE OR REPLACE FUNCTION public.accept_invite(_token UUID, _user_id UUID)
RETURNS BOOLEAN
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

  -- Add role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, invite_record.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Mark invite as accepted
  UPDATE public.organization_invites
  SET status = 'accepted'
  WHERE id = invite_record.id;

  RETURN TRUE;
END;
$$;