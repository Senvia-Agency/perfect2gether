-- Criar função para obter nome da organização pelo token do convite (bypass RLS)
CREATE OR REPLACE FUNCTION public.get_org_name_by_invite_token(_token uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.name 
  FROM public.organization_invites oi
  JOIN public.organizations o ON o.id = oi.organization_id
  WHERE oi.token = _token
    AND oi.status = 'pending'
    AND oi.expires_at > now()
$$;