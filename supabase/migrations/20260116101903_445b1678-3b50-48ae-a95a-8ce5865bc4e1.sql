-- Função SECURITY DEFINER para verificar membership antes do login
-- Isto evita a race condition do RLS após signIn()
CREATE OR REPLACE FUNCTION public.verify_user_org_membership(
  p_email TEXT,
  p_org_slug TEXT
)
RETURNS TABLE (
  user_id UUID,
  organization_id UUID,
  organization_name TEXT,
  is_member BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id as user_id,
    o.id as organization_id,
    o.name as organization_name,
    EXISTS (
      SELECT 1 FROM organization_members om 
      WHERE om.user_id = u.id 
      AND om.organization_id = o.id 
      AND om.is_active = true
    ) as is_member
  FROM auth.users u
  CROSS JOIN organizations o
  WHERE u.email = p_email
    AND o.slug = p_org_slug;
$$;