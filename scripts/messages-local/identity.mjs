const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value) { return typeof value === 'string' && uuid.test(value); }

export function createIdentityResolver({ url, publicKey, db, fetcher = fetch }) {
  const cache = new Map();
  async function read(route, token) {
    const response = await fetcher(`${url}${route}`, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Não foi possível confirmar a conta e a equipa. Inicie sessão novamente.');
    return response.json();
  }
  return async function resolve(authorization, org) {
    if (!authorization?.startsWith('Bearer ') || !isUuid(org)) throw new Error('Inicie sessão no P2G e selecione a organização.');
    const token = authorization.slice(7), key = `${token}:${org}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.identity;
    const user = await read('/auth/v1/user', token);
    if (!isUuid(user.id)) throw new Error('Sessão inválida.');
    const members = await read(`/rest/v1/organization_members?organization_id=eq.${org}&select=user_id,is_active,profile_id`, token);
    if (!members.some(member => member.user_id === user.id && member.is_active)) throw new Error('Sem acesso ativo a esta organização.');
    const profiles = await read(`/rest/v1/profiles?id=in.(${members.map(member => member.user_id).filter(isUuid).join(',')})&select=id,full_name,avatar_url`, token);
    const orgProfiles = await read(`/rest/v1/organization_profiles?organization_id=eq.${org}&select=id,base_role`, token);
    const roles = await read(`/rest/v1/user_roles?user_id=eq.${user.id}&select=role`, token);
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const identity = { userId: user.id, org, aal: claims.aal === 'aal2' ? 'aal2' : 'aal1' };
    await db.exec('RESET ROLE');
    await db.transaction(async tx => {
      await tx.query('INSERT INTO public.organizations VALUES($1) ON CONFLICT DO NOTHING', [org]);
      await tx.query('UPDATE public.organization_members SET is_active=false WHERE organization_id=$1', [org]);
      for (const member of members) await tx.query('INSERT INTO public.organization_members VALUES($1,$2,$3,$4) ON CONFLICT(user_id,organization_id) DO UPDATE SET is_active=excluded.is_active,profile_id=excluded.profile_id', [member.user_id, org, member.is_active, member.profile_id]);
      for (const profile of profiles) await tx.query('INSERT INTO public.profiles VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,avatar_url=excluded.avatar_url', [profile.id, profile.full_name, profile.avatar_url]);
      for (const profile of orgProfiles) await tx.query('INSERT INTO public.organization_profiles VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET base_role=excluded.base_role', [profile.id, org, profile.base_role]);
      await tx.query('DELETE FROM public.user_roles WHERE user_id=$1', [user.id]);
      for (const role of roles) await tx.query('INSERT INTO public.user_roles VALUES($1,$2)', [user.id, role.role]);
    });
    if (cache.size > 100) cache.clear();
    cache.set(key, { identity, expires: Date.now() + 15000 });
    return identity;
  };
}
