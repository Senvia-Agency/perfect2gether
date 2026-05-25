-- Diretor Comercial: visibilidade total dos dados da organização.
--
-- Problema: a função app_can_view_user_data só tratava 'team' (líder de equipa)
-- e o papel admin/super_admin. Perfis com data_scope='all' que não tinham
-- base_role='admin' (caso do Diretor Comercial, base salesperson) caíam no
-- fallback "só dados próprios" — apesar do frontend já reconhecer 'all'.
--
-- Esta migração:
--   1. Adiciona o ramo data_scope='all' à função RLS, de forma reutilizável
--      para qualquer perfil de organização que precise de ver tudo.
--   2. Marca o perfil "Diretor Comercial" como data_scope='all'.

CREATE OR REPLACE FUNCTION public.app_can_view_user_data(target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select coalesce(
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
    or target_user = auth.uid()
    or exists (
      select 1 from organization_members om
      join organization_profiles op on op.id = om.profile_id
      where om.user_id = auth.uid()
        and om.organization_id = get_user_org_id(auth.uid())
        and op.data_scope = 'all'
    )
    or (
      exists (
        select 1 from organization_members om
        join organization_profiles op on op.id = om.profile_id
        where om.user_id = auth.uid()
          and om.organization_id = get_user_org_id(auth.uid())
          and op.data_scope = 'team'
      )
      and exists (
        select 1 from teams t
        join team_members tm on tm.team_id = t.id
        where t.leader_id = auth.uid() and tm.user_id = target_user
      )
    ), false);
$function$;

UPDATE public.organization_profiles
SET data_scope = 'all'
WHERE id = 'aba765e2-9739-40b7-bc9c-84e007534124'
  AND organization_id = '96a3950e-31be-4c6d-abed-b82968c0d7e9'
  AND name = 'Diretor Comercial';
