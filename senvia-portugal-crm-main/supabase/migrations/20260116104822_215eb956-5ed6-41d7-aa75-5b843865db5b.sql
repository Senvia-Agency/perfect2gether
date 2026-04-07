-- Update get_user_organizations to return ALL orgs for super_admins
CREATE OR REPLACE FUNCTION public.get_user_organizations(_user_id uuid)
RETURNS TABLE(
  organization_id uuid,
  organization_name text,
  organization_code text,
  organization_slug text,
  member_role app_role,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Se é super_admin, retornar TODAS as organizações
  SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.code as organization_code,
    o.slug as organization_slug,
    'super_admin'::app_role as member_role,
    true as is_active
  FROM organizations o
  WHERE EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = _user_id 
    AND ur.role = 'super_admin'
  )
  
  UNION
  
  -- Retornar organizações com membership direto (para users normais)
  SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.code as organization_code,
    o.slug as organization_slug,
    om.role as member_role,
    om.is_active
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.user_id = _user_id 
    AND om.is_active = true
    -- Evitar duplicados se super_admin também tem membership
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = _user_id 
      AND ur.role = 'super_admin'
    )
  
  ORDER BY organization_name ASC;
$$;