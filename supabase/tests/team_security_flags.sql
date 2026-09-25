-- Read-only assertions, safe to run against the deployed function.
do $$
begin
  if has_function_privilege('anon', 'public.get_team_member_security_flags(uuid[])', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_team_member_security_flags(uuid[])', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_team_member_security_flags(uuid[])', 'EXECUTE') then
    raise exception 'Security flags RPC must only be callable by the server';
  end if;

  if exists (select 1 from public.get_team_member_security_flags('{}'::uuid[])) then
    raise exception 'Empty input must not return users';
  end if;

  if exists (
    select 1
    from auth.users u
    left join public.get_team_member_security_flags(array(select id from auth.users)) f
      on f.user_id = u.id
    where f.user_id is null
       or f.is_banned is distinct from coalesce(u.banned_until > now(), false)
       or f.has_mfa is distinct from exists (
         select 1 from auth.mfa_factors m
         where m.user_id = u.id and m.factor_type = 'totp' and m.status = 'verified'
       )
  ) then
    raise exception 'Batched flags must preserve actual ban and MFA states';
  end if;

  if (select count(*) from public.get_team_member_security_flags(array(select id from auth.users)))
     <> (select count(*) from auth.users) then
    raise exception 'Expected exactly one row per user';
  end if;
end;
$$;
