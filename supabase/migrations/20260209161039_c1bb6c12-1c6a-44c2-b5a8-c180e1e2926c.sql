
-- 1. Funcao auxiliar SECURITY DEFINER para verificar membership sem recursao
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND is_active = true
  )
$$;

-- 2. Remover politica que causa recursao
DROP POLICY IF EXISTS "Admins manage org members" ON public.organization_members;

-- 3. Criar politica corrigida usando a funcao segura
CREATE POLICY "Admins manage org members"
ON public.organization_members
FOR ALL
TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  is_org_member(auth.uid(), organization_id)
  AND has_role(auth.uid(), 'admin'::app_role)
);
