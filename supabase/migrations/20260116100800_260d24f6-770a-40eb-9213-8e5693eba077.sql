-- Update get_user_organizations to use slug as organization_code
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
    o.slug as organization_code,  -- Using slug as the code
    o.slug as organization_slug,
    om.role as member_role,
    om.is_active
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.user_id = _user_id AND om.is_active = true
  ORDER BY om.joined_at ASC;
$$;