-- 1. Add code column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- 2. Create function to generate organization codes
CREATE OR REPLACE FUNCTION public.generate_organization_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM organizations WHERE code IS NOT NULL AND code ~ '^ORG-[0-9]+$';
  NEW.code := 'ORG-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- 3. Create trigger for auto-generating org codes
DROP TRIGGER IF EXISTS set_org_code ON public.organizations;
CREATE TRIGGER set_org_code
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  WHEN (NEW.code IS NULL)
  EXECUTE FUNCTION public.generate_organization_code();

-- 4. Generate codes for existing organizations that don't have one
UPDATE public.organizations
SET code = 'ORG-' || LPAD(sub.rn::TEXT, 4, '0')
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.organizations
  WHERE code IS NULL
) sub
WHERE organizations.id = sub.id AND organizations.code IS NULL;

-- 5. Create organization_members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- 6. Enable RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 7. Migrate existing users from profiles to organization_members
INSERT INTO public.organization_members (user_id, organization_id, role)
SELECT 
  p.id as user_id,
  p.organization_id,
  COALESCE(
    (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
    'viewer'::public.app_role
  ) as role
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- 8. Create RLS policies for organization_members
CREATE POLICY "Users view own memberships"
  ON public.organization_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Super admin full access organization_members"
  ON public.organization_members
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins manage org members"
  ON public.organization_members
  FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om 
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om 
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
    AND public.has_role(auth.uid(), 'admin')
  );

-- 9. Create function to get user's organizations
CREATE OR REPLACE FUNCTION public.get_user_organizations(_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_code TEXT,
  organization_slug TEXT,
  member_role public.app_role,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.code as organization_code,
    o.slug as organization_slug,
    om.role as member_role,
    om.is_active
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.user_id = _user_id AND om.is_active = true
  ORDER BY om.joined_at ASC;
$$;

-- 10. Update get_user_org_id to support active organization from app_metadata
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_org UUID;
  jwt_claims JSON;
BEGIN
  -- Try to get active_organization_id from JWT claims (app_metadata)
  BEGIN
    jwt_claims := current_setting('request.jwt.claims', true)::json;
    active_org := (jwt_claims->'app_metadata'->>'active_organization_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    active_org := NULL;
  END;
  
  -- If we have an active org from JWT, verify membership
  IF active_org IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = _user_id AND organization_id = active_org AND is_active = true
    ) THEN
      RETURN active_org;
    END IF;
  END IF;
  
  -- Fallback: get from organization_members (first org)
  SELECT om.organization_id INTO active_org
  FROM organization_members om
  WHERE om.user_id = _user_id AND om.is_active = true
  ORDER BY om.joined_at ASC
  LIMIT 1;
  
  IF active_org IS NOT NULL THEN
    RETURN active_org;
  END IF;
  
  -- Final fallback: get from profiles (legacy)
  SELECT p.organization_id INTO active_org
  FROM profiles p
  WHERE p.id = _user_id;
  
  RETURN active_org;
END;
$$;