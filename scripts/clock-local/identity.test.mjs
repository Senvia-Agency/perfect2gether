import test from 'node:test';
import assert from 'node:assert/strict';
import { createClockIdentityResolver } from './identity.mjs';
import { createClockDatabase, clockSession, clockRpc, clockIds as i } from '../../supabase/tests/timeclock-database-fixture.mjs';
const token = 'header.' + Buffer.from(JSON.stringify({ aal: 'aal2' })).toString('base64url') + '.signature';
const data = {
  '/auth/v1/user': { id: i.employee },
  '/rest/v1/organization_members': [{ user_id: i.employee, profile_id: i.profilePlain, is_active: true }, { user_id: i.manager, profile_id: i.profileManage, is_active: true }],
  '/rest/v1/profiles': [{ id: i.employee, full_name: 'Employee', avatar_url: null }, { id: i.manager, full_name: 'Manager', avatar_url: null }],
  '/rest/v1/organization_profiles': [{ id: i.profilePlain, base_role: 'collaborator', module_permissions: { rh: { subareas: { employees: { manage: true } } } } }, { id: i.profileManage, base_role: 'collaborator', module_permissions: { rh: { subareas: { timeclock: { manage: true } } } } }],
  '/rest/v1/user_roles': [], '/rest/v1/organizations': [{ id: i.org, name: 'Local only' }],
};
test('local account mirror preserves exact clock permissions without inheriting unrelated RH grants', async () => {
  const db = await createClockDatabase(undefined, { seed: false });
  try {
    const resolver = createClockIdentityResolver({ db, url: 'https://verified.test', publicKey: 'public', fetcher: async url => { const route = new URL(url).pathname; assert.ok(route in data); return Response.json(data[route]); } });
    const identity = await resolver('Bearer ' + token, i.org);
    await clockSession(db, identity.userId, 'authenticated', identity.aal);
    const snapshot = await clockRpc(db, 'snapshot', {});
    assert.equal(snapshot.can_manage, false); assert.equal(snapshot.people.length, 1);
    await clockSession(db, i.manager, 'authenticated', 'aal2');
    assert.equal((await clockRpc(db, 'snapshot', {})).can_manage, true);
  } finally { await db.close(); }
});
test('local resolver rejects missing bearer and membership without creating identity rows', async () => {
  const db = await createClockDatabase(undefined, { seed: false });
  try {
    const resolver = createClockIdentityResolver({ db, url: 'https://verified.test', publicKey: 'public', fetcher: async url => Response.json(new URL(url).pathname === '/auth/v1/user' ? { id: i.employee } : []) });
    await assert.rejects(() => resolver('', i.org)); await assert.rejects(() => resolver('Bearer ' + token, i.org));
    assert.equal((await db.query('SELECT count(*)::int n FROM organization_members')).rows[0].n, 0);
  } finally { await db.close(); }
});
test('local mirror retains verified TOTP factors and still rejects aal1', async () => {
  const db = await createClockDatabase(undefined, { seed: false });
  const org = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
  try {
    const resolver = createClockIdentityResolver({ db, url: 'https://verified.test', publicKey: 'public', fetcher: async url => {
      const route = new URL(url).pathname;
      return Response.json(route === '/auth/v1/user' ? { id: i.employee, factors: [{ factor_type: 'totp', status: 'verified' }] } : data[route]);
    } });
    const identity = await resolver('Bearer ' + token, org);
    await clockSession(db, identity.userId, 'authenticated', identity.aal);
    assert.equal((await clockRpc(db, 'snapshot', { org })).entries.length, 0);
    await clockSession(db, identity.userId, 'authenticated', 'aal1');
    await assert.rejects(() => clockRpc(db, 'snapshot', { org }), /access_denied/);
  } finally { await db.close(); }
});
