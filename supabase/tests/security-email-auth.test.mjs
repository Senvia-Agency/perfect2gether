import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const functionsRoot = fileURLToPath(new URL('../functions/', import.meta.url));
const member = { id: 'member-1', user_id: 'user-1', organization_id: 'org-1', is_active: true, role: 'salesperson', profile_id: null };
const email = { organizationId: 'org-1', to: 'client@example.test', clientName: 'Client', proposalCode: 'P-1', proposalDate: '2026-09-14', totalValue: 10, products: [], orgName: 'Example' };

function loadHandler(name, fixture = {}) {
  let handler;
  const calls = [];
  const rows = {
    organization_members: fixture.members ?? [member],
    user_roles: fixture.roles ?? [{ user_id: 'user-1', role: 'salesperson' }],
    organization_profiles: fixture.profiles ?? [],
    organizations: [{ id: 'org-1', name: 'Example', brevo_api_key: 'fake-brevo', brevo_sender_email: 'sender@example.test', keyinvoice_password: 'fake-keyinvoice', ...(fixture.org ?? {}) }],
  };
  const client = {
    auth: { async getUser(token) {
      calls.push({ kind: 'auth', token });
      return token === 'valid-user' ? { data: { user: { id: 'user-1' } }, error: null } : { data: { user: null }, error: { message: 'Invalid JWT' } };
    } },
    from(table) {
      calls.push({ kind: 'table', table });
      const filters = [];
      let update;
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        update(value) { update = value; return query; },
        result(single) {
          if (fixture.failTable === table) return { data: null, error: { message: 'Database unavailable' } };
          const selected = (rows[table] ?? []).filter(row => filters.every(([key, value]) => row[key] === value));
          if (update) calls.push({ kind: 'update', table, update });
          return { data: single ? selected[0] ?? null : selected, error: null };
        },
        async single() { return query.result(true); },
        async maybeSingle() { return query.result(true); },
        then(onFulfilled, onRejected) { return Promise.resolve(query.result(false)).then(onFulfilled, onRejected); },
      };
      return query;
    },
  };
  const cache = new Map();
  const globals = {
    Request, Response, Headers, URL,
    console: { log() {}, error() {} },
    Deno: { env: { get: name => ({ SUPABASE_URL: 'https://supabase.example.test', SUPABASE_SERVICE_ROLE_KEY: 'fake-service' })[name] }, serve: callback => { handler = callback; } },
    fetch: async (url, options) => {
      calls.push({ kind: 'fetch', url, body: JSON.parse(options.body) });
      return Response.json(name === 'send-proposal-email' ? { messageId: 'fake-message' } : { Status: 1, Sid: 'fake-session' });
    },
  };
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    cache.set(path, module.exports);
    vm.runInNewContext(output, { ...globals, module, exports: module.exports, require: specifier => {
      if (specifier.includes('edge-runtime.d.ts')) return {};
      if (specifier.includes('supabase-js')) return { createClient: () => client };
      return specifier.startsWith('.') ? load(resolve(dirname(path), specifier)) : require(specifier);
    } }, { filename: path });
    return module.exports;
  }
  load(resolve(functionsRoot, name, 'index.ts'));
  return { calls, async send(authorization = 'Bearer valid-user', body = name === 'send-proposal-email' ? email : { organization_id: 'org-1' }, method = 'POST') {
    const headers = { 'Content-Type': 'application/json' };
    if (authorization) headers.Authorization = authorization;
    return handler(new Request('https://edge.example.test', { method, headers, ...(method === 'OPTIONS' ? {} : { body: JSON.stringify(body) }) }));
  } };
}

function assertNoPrivilegedWork(calls) {
  assert.equal(calls.some(call => call.kind === 'fetch' || (call.kind === 'table' && call.table === 'organizations')), false);
}

for (const name of ['send-proposal-email', 'keyinvoice-auth']) {
  for (const role of ['super_admin', 'admin']) {
    for (const members of [[], [{ ...member, is_active: false }]]) {
      test(`${name} preserves only global super-admin access with ${role} and ${members.length ? 'inactive' : 'missing'} membership`, async () => {
        // Given a verified role and no active membership in the selected organization.
        const app = loadHandler(name, { members, roles: [{ user_id: member.user_id, role }] });
        // When using the cross-organization workflow exposed by get_user_organizations.
        const response = await app.send();
        // Then only a global super-admin can continue without active membership.
        assert.equal(response.status, role === 'super_admin' ? 200 : 403);
        if (role === 'super_admin') assert.equal(app.calls.filter(call => call.kind === 'fetch').length, 1);
        else assertNoPrivilegedWork(app.calls);
      });
    }
  }
  for (const fixture of [
    { roles: [{ user_id: member.user_id, role: 'super_admin' }], failTable: 'user_roles' },
    { roles: [{ user_id: 'other-user', role: 'super_admin' }] },
  ]) {
    test(`${name} denies an unestablished global super-admin role ${JSON.stringify(fixture)}`, async () => {
      // Given missing membership and either a failed lookup or another user's role.
      const app = loadHandler(name, { members: [], ...fixture });
      // When attempting the global administrator workflow.
      const response = await app.send();
      // Then role uncertainty cannot expose organization credentials.
      assert.equal(response.status, 403);
      assertNoPrivilegedWork(app.calls);
    });
  }
}

for (const name of ['send-proposal-email', 'keyinvoice-auth']) {
  test(`${name} denies access when membership lookup fails`, async () => {
    // Given a verified caller whose membership cannot be established.
    const app = loadHandler(name, { failTable: 'organization_members' });
    // When authorization storage fails.
    const response = await app.send();
    // Then no organization credentials or remote API is used.
    assert.equal(response.status, 403);
    assertNoPrivilegedWork(app.calls);
  });
  for (const authorization of [null, 'Bearer invalid', 'Basic valid-user', 'Bearer fake-service']) {
    test(`${name} denies unverified caller ${authorization}`, async () => {
      // Given an unauthenticated caller and a valid target organization.
      const app = loadHandler(name);
      // When the actual handler receives the request.
      const response = await app.send(authorization);
      // Then credentials and external services remain untouched.
      assert.equal(response.status, 401);
      assertNoPrivilegedWork(app.calls);
    });
  }
  for (const invalidMember of [null, { ...member, organization_id: 'other-org' }, { ...member, user_id: 'other-user' }, { ...member, is_active: false }]) {
    test(`${name} denies missing, foreign, or inactive membership ${JSON.stringify(invalidMember)}`, async () => {
      // Given a verified caller without active membership in the target organization.
      const app = loadHandler(name, { members: invalidMember ? [invalidMember] : [] });
      // When requesting the privileged operation.
      const response = await app.send();
      // Then the caller cannot use organization credentials.
      assert.equal(response.status, 403);
      assertNoPrivilegedWork(app.calls);
    });
  }
  test(`${name} preserves unauthenticated CORS preflight`, async () => {
    // Given a browser preflight without a token.
    const app = loadHandler(name);
    // When OPTIONS is handled.
    const response = await app.send(null, null, 'OPTIONS');
    // Then preflight succeeds without any privileged operations.
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(app.calls.length, 0);
  });
}

for (const role of ['salesperson', 'admin', 'viewer']) {
  test(`proposal email preserves active ${role} workflow regardless of module profile`, async () => {
    // Given an active member who can use the existing proposal email UI.
    const app = loadHandler('send-proposal-email', { members: [{ ...member, role, profile_id: 'restricted' }], roles: [{ user_id: member.user_id, role }], profiles: [{ id: 'restricted', organization_id: 'org-1', module_permissions: { proposals: { subareas: { general: { edit: false } } } } }] });
    // When sending a proposal.
    const response = await app.send();
    // Then the existing Brevo send contract succeeds with a fake network.
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, messageId: 'fake-message' });
    assert.equal(app.calls.filter(call => call.kind === 'fetch').length, 1);
  });
}

for (const scenario of [
  { name: 'admin fallback', role: 'admin', permissions: null, allowed: true },
  { name: 'commercial fallback', role: 'salesperson', permissions: null, allowed: false },
  { name: 'granular integration editor', role: 'salesperson', permissions: { settings: { subareas: { general: { edit: true } } } }, allowed: true },
  { name: 'granular explicit admin deny', role: 'admin', permissions: { settings: { subareas: { general: { edit: false } } } }, allowed: false },
  { name: 'legacy integration editor', role: 'salesperson', permissions: { settings: { view: true, edit: true, delete: false } }, allowed: true },
  { name: 'legacy explicit admin deny', role: 'admin', permissions: { settings: { view: true, edit: false, delete: false } }, allowed: false },
  { name: 'super admin', role: 'super_admin', permissions: { settings: { subareas: { general: { edit: false } } } }, allowed: true },
]) {
  test(`keyinvoice-auth mirrors integration settings for ${scenario.name}`, async () => {
    // Given the same role and profile configuration consumed by usePermissions.
    const app = loadHandler('keyinvoice-auth', { members: [{ ...member, role: scenario.role, profile_id: scenario.permissions ? 'profile-1' : null }], roles: [{ user_id: member.user_id, role: scenario.role }], profiles: [{ id: 'profile-1', organization_id: 'org-1', module_permissions: scenario.permissions }] });
    // When requesting a KeyInvoice session.
    const response = await app.send();
    // Then only integration settings editors receive a session.
    assert.equal(response.status, scenario.allowed ? 200 : 403);
    if (scenario.allowed) assert.deepEqual(await response.json(), { token: 'fake-session' });
    else assertNoPrivilegedWork(app.calls);
  });
}

test('keyinvoice-auth preserves the cached session path for authorized administrators', async () => {
  // Given an administrator and a reusable session.
  const app = loadHandler('keyinvoice-auth', { roles: [{ user_id: member.user_id, role: 'admin' }], org: { keyinvoice_sid: 'cached-session', keyinvoice_sid_expires_at: '2099-01-01T00:00:00Z' } });
  // When the integration requests its session.
  const response = await app.send();
  // Then the existing cached token is returned without reauthentication.
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { token: 'cached-session' });
  assert.equal(app.calls.filter(call => call.kind === 'fetch').length, 0);
});

for (const fixture of [
  { failTable: 'user_roles' },
  { failTable: 'organization_profiles', members: [{ ...member, profile_id: 'profile-1' }] },
  { members: [{ ...member, profile_id: 'profile-1' }], profiles: [{ id: 'profile-1', organization_id: 'other-org', module_permissions: { settings: { view: true, edit: true } } }] },
]) {
  test(`keyinvoice-auth denies uncertain or foreign profile authorization ${JSON.stringify(fixture)}`, async () => {
    // Given a role/profile lookup failure or a profile from another organization.
    const app = loadHandler('keyinvoice-auth', fixture);
    // When the caller requests a session.
    const response = await app.send();
    // Then the authorization uncertainty cannot expose credentials.
    assert.equal(response.status, 403);
    assertNoPrivilegedWork(app.calls);
  });
}

test('keyinvoice-auth denies cached session disclosure to ordinary commercial members', async () => {
  // Given a cached session and a member without integration settings access.
  const app = loadHandler('keyinvoice-auth', { org: { keyinvoice_sid: 'cached-session', keyinvoice_sid_expires_at: '2099-01-01T00:00:00Z' } });
  // When the caller requests the session.
  const response = await app.send();
  // Then the cached secret is never read or returned.
  assert.equal(response.status, 403);
  assertNoPrivilegedWork(app.calls);
});
