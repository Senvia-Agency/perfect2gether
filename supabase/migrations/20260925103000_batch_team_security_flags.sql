-- Avoid 2 Auth API requests per member every time a dashboard/filter loads.
-- Called only by the already-authorized get-team-members Edge Function.
create or replace function public.get_team_member_security_flags(p_user_ids uuid[])
returns table (user_id uuid, is_banned boolean, has_mfa boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         coalesce(u.banned_until > now(), false),
         exists (
           select 1 from auth.mfa_factors f
           where f.user_id = u.id
             and f.factor_type = 'totp'
             and f.status = 'verified'
         )
  from auth.users u
  where u.id = any(p_user_ids);
$$;

revoke all on function public.get_team_member_security_flags(uuid[]) from public, anon, authenticated;
grant execute on function public.get_team_member_security_flags(uuid[]) to service_role;
