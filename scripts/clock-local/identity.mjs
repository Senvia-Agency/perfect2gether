import { isUuid } from '../messages-local/identity.mjs';
export function createClockIdentityResolver({ db, url, publicKey, fetcher = fetch }) {
  const cache = new Map();
  async function read(route, token) {
    const res = await fetcher(url + route, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('Não foi possível confirmar a sessão e as permissões do ponto.');
    return res.json();
  }
  return async (authorization, org) => {
    if (!authorization?.startsWith('Bearer ') || !isUuid(org)) throw new Error('Inicie sessão e selecione a organização.');
    const token = authorization.slice(7), key = token + ':' + org, hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.identity;
    const user = await read('/auth/v1/user', token);
    if (!isUuid(user.id)) throw new Error('Sessão inválida.');
    const members = await read(`/rest/v1/organization_members?organization_id=eq.${org}&select=user_id,is_active,profile_id`, token);
    if (!members.some(m => m.user_id === user.id && m.is_active)) throw new Error('Sem vínculo ativo a esta organização.');
    const ids = members.map(m => m.user_id).filter(isUuid);
    const [profiles, permissions, roles, organizations] = await Promise.all([
      read(`/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,full_name,avatar_url`, token),
      read(`/rest/v1/organization_profiles?organization_id=eq.${org}&select=id,name,base_role,module_permissions`, token),
      read(`/rest/v1/user_roles?user_id=eq.${user.id}&select=role`, token),
      read(`/rest/v1/organizations?id=eq.${org}&select=id,name`, token),
    ]);
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const identity = { userId: user.id, org, aal: claims.aal === 'aal2' ? 'aal2' : 'aal1' };
    await db.exec('RESET ROLE');
    await db.transaction(async tx => {
      await tx.query('INSERT INTO organizations(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=excluded.name', [org, organizations[0]?.name ?? 'Perfect2Gether']);
      await tx.query('DELETE FROM organization_security_settings WHERE organization_id=$1', [org]);
      await tx.query('INSERT INTO organization_security_settings VALUES($1,true)', [org]);
      await tx.query('DELETE FROM auth.mfa_factors WHERE user_id=$1', [user.id]);
      for (const factor of user.factors ?? []) {
        if (factor.factor_type === 'totp' && factor.status === 'verified') await tx.query('INSERT INTO auth.mfa_factors(user_id,factor_type,status) VALUES($1,$2,$3)', [user.id, factor.factor_type, factor.status]);
      }
      await tx.query('UPDATE organization_members SET is_active=false WHERE organization_id=$1', [org]);
      for (const member of members) {
        await tx.query('INSERT INTO auth.users(id) VALUES($1) ON CONFLICT DO NOTHING', [member.user_id]);
        await tx.query('INSERT INTO organization_members(user_id,organization_id,is_active,profile_id) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,organization_id) DO UPDATE SET is_active=excluded.is_active,profile_id=excluded.profile_id', [member.user_id, org, member.is_active, member.profile_id]);
      }
      for (const p of profiles) await tx.query('INSERT INTO profiles(id,full_name,avatar_url) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,avatar_url=excluded.avatar_url', [p.id, p.full_name, p.avatar_url]);
      for (const p of permissions) await tx.query('INSERT INTO organization_profiles(id,organization_id,base_role,module_permissions) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET base_role=excluded.base_role,module_permissions=excluded.module_permissions', [p.id, org, p.base_role, p.module_permissions]);
      await tx.query('DELETE FROM user_roles WHERE user_id=$1', [user.id]);
      for (const role of roles) await tx.query('INSERT INTO user_roles VALUES($1,$2)', [user.id, role.role]);
    });
    if (cache.size > 100) cache.clear();
    cache.set(key, { until: Date.now() + 15000, identity });
    return identity;
  };
}
