import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = new URL('../migrations/20260929120000_require_p2g_mfa.sql', import.meta.url);
const p2g = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const otherOrg = '00000000-0000-4000-8000-000000000002';
const member = '00000000-0000-4000-8000-000000000011';
const outsider = '00000000-0000-4000-8000-000000000012';
const superAdmin = '00000000-0000-4000-8000-000000000013';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb
    $$;
    create table public.organizations(id uuid primary key);
    create table public.organization_members(user_id uuid, organization_id uuid, is_active boolean);
    create table public.user_roles(user_id uuid, role text);
    create table auth.mfa_factors(id uuid primary key, user_id uuid, factor_type text, status text);
    create table public.leads(id uuid primary key);
    create table public.proposals(id uuid primary key);
    create table public.sales(id uuid primary key);
    create table storage.objects(id uuid primary key);
    alter table public.leads enable row level security;
    alter table public.proposals enable row level security;
    alter table public.sales enable row level security;
    alter table storage.objects enable row level security;
    create policy old_leads on public.leads for all to authenticated using (true) with check (true);
    create policy old_proposals on public.proposals for all to authenticated using (true) with check (true);
    create policy old_sales on public.sales for all to authenticated using (true) with check (true);
    create policy old_storage on storage.objects for all to authenticated using (true) with check (true);
    grant usage on schema public, auth, storage to authenticated, anon, service_role;
    grant all on public.leads, public.proposals, public.sales, storage.objects to authenticated;
    insert into public.organizations values ('${p2g}'), ('${otherOrg}');
    insert into public.organization_members values
      ('${member}', '${p2g}', true),
      ('${outsider}', '${otherOrg}', true);
    insert into public.user_roles values ('${superAdmin}', 'super_admin');
    insert into public.leads values ('00000000-0000-4000-8000-000000000101');
    insert into public.proposals values ('00000000-0000-4000-8000-000000000102');
    insert into public.sales values ('00000000-0000-4000-8000-000000000103');
    insert into storage.objects values ('00000000-0000-4000-8000-000000000104');
  `);
  await db.exec(await readFile(migration, 'utf8'));
  return db;
}

async function asUser(db, { user, aal = 'aal1', role = 'authenticated', path = 'leads' }, action) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    await db.query("select set_config('request.jwt.claim.role', $1, true)", [role]);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ aal, role, sub: user })]);
    await db.query("select set_config('request.path', $1, true)", [path]);
    await db.exec(`set local role ${role}`);
    return await action();
  } finally {
    await db.exec('rollback');
  }
}

async function expectDenied(db) {
  await db.exec('savepoint denied_request');
  try {
    await assert.rejects(() => db.exec('select public.enforce_p2g_mfa()'), error => error.code === '42501');
  } finally {
    await db.exec('rollback to savepoint denied_request');
  }
}

test('mandatory MFA starts disabled and has no effect on existing access', async () => {
  const db = await setup();
  try {
    await asUser(db, { user: member }, async () => {
      assert.equal((await db.query('select public.p2g_mfa_required() required')).rows[0].required, false);
      assert.equal((await db.query('select count(*)::int n from leads')).rows[0].n, 1);
      await db.exec('select public.enforce_p2g_mfa()');
    });
  } finally { await db.close(); }
});

test('activated MFA blocks unverified P2G sessions at API and realtime/storage boundaries', async () => {
  const db = await setup();
  try {
    await db.exec(`update public.organization_security_settings set require_mfa=true where organization_id='${p2g}'`);
    await asUser(db, { user: member }, async () => {
      assert.equal((await db.query('select public.p2g_mfa_required() required')).rows[0].required, true);
      await expectDenied(db);
      for (const table of ['leads', 'proposals', 'sales']) {
        assert.equal((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n, 0);
      }
      assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n, 0);
    });
    await asUser(db, { user: member, path: 'rpc/p2g_mfa_required' }, async () => {
      await db.exec('select public.enforce_p2g_mfa()');
    });
    await asUser(db, { user: member, aal: 'aal2' }, async () => {
      await expectDenied(db);
    });
    await db.exec(`insert into auth.mfa_factors values ('00000000-0000-4000-8000-000000000201','${member}','totp','verified')`);
    await asUser(db, { user: member, aal: 'aal2' }, async () => {
      await db.exec('select public.enforce_p2g_mfa()');
      assert.equal((await db.query('select count(*)::int n from leads')).rows[0].n, 1);
      assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n, 1);
    });
  } finally { await db.close(); }
});

test('unrelated tenants and public requests retain access; super admin is included', async () => {
  const db = await setup();
  try {
    await db.exec(`update public.organization_security_settings set require_mfa=true where organization_id='${p2g}'`);
    await asUser(db, { user: outsider }, async () => {
      await db.exec('select public.enforce_p2g_mfa()');
      assert.equal((await db.query('select count(*)::int n from leads')).rows[0].n, 1);
    });
    await asUser(db, { user: superAdmin }, async () => {
      await expectDenied(db);
    });
    await asUser(db, { user: null, role: 'anon' }, async () => {
      await db.exec('select public.enforce_p2g_mfa()');
    });
  } finally { await db.close(); }
});
