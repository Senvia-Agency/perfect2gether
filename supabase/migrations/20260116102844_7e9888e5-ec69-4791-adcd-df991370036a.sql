-- 1. Atribuir role super_admin ao geral.senvia@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role
FROM auth.users 
WHERE email = 'geral.senvia@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Atualizar função verify_user_org_membership para permitir super admins
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
    (
      -- Super admins SEMPRE têm acesso a qualquer organização
      EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = u.id 
        AND ur.role = 'super_admin'
      )
      OR
      -- Ou é membro activo da organização
      EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.user_id = u.id 
        AND om.organization_id = o.id 
        AND om.is_active = true
      )
    ) as is_member
  FROM auth.users u
  CROSS JOIN organizations o
  WHERE u.email = p_email
    AND o.slug = p_org_slug;
$$;

-- 3. Criar função para listar TODAS as organizações (para super admins no dashboard)
CREATE OR REPLACE FUNCTION public.get_all_organizations()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  organization_code TEXT,
  member_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.slug as organization_slug,
    o.code as organization_code,
    (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id AND om.is_active = true) as member_count
  FROM organizations o
  ORDER BY o.created_at ASC;
$$;