import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrations = new URL('../migrations/', import.meta.url);
const readMigration = (name) => readFile(new URL(name, migrations), 'utf8');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = id(100);
const otherOrg = id(200);
const salesperson = id(1);
const colleague = id(2);
const admin = id(3);
const inactive = id(4);
const superAdmin = id(5);
const profileAdmin = id(6);
const fix = '20260914180000_allow_own_monthly_commitments.sql';

async function setup(db) {
  // Minimal surrounding schema; target tables, policies and permission helpers
  // are loaded from the actual repository migrations below.
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create type public.app_role as enum ('super_admin','admin','viewer','salesperson');
    create table public.organizations (id uuid primary key);
    create table public.profiles (id uuid primary key, organization_id uuid);
    create table public.proposals (id uuid primary key);
    create table public.user_roles (user_id uuid, role public.app_role);
    create table public.organization_profiles (
      id uuid primary key, organization_id uuid, base_role public.app_role,
      module_permissions jsonb
    );
    create table public.organization_members (
      user_id uuid, organization_id uuid, profile_id uuid,
      is_active boolean default true, joined_at timestamptz default now(),
      primary key(user_id, organization_id)
    );
    create function public.update_updated_at_column() returns trigger
    language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
  `);
  const initial = await readMigration('20260107164052_8f035175-4d4f-4623-bd5f-c93d31f5ccd2.sql');
  const roleDefinition = initial.match(/CREATE OR REPLACE FUNCTION public\.has_role\([\s\S]*?\$\$;/);
  assert.ok(roleDefinition, 'Repository definition of has_role must exist');
  await db.exec(roleDefinition[0]);
  const membership = await readMigration('20260209161039_c1bb6c12-1c6a-44c2-b5a8-c180e1e2926c.sql');
  await db.exec(membership.match(/CREATE OR REPLACE FUNCTION public\.is_org_member\([\s\S]*?\$\$;/)[0]);
  await db.exec(await readMigration('20260309154707_8d9d73d9-6a4d-40de-b2a4-84d9aa5bf95b.sql'));
  for (const name of [
    '20260303112629_2bb2d95f-ee8f-4f33-8b58-a7fba581c68a.sql',
    '20260303113445_c6d38def-38d7-4f40-ae5b-6fc3b57f108d.sql',
    '20260303114025_b4c898de-7ce3-4ec2-9853-1cfeea060fa8.sql',
    '20260624120000_module_permissions_rls.sql',
  ]) await db.exec(await readMigration(name));

  await db.exec(`
    grant usage on schema public, auth to authenticated, anon;
    grant select, insert, update, delete on public.monthly_commitments to authenticated, anon;
    insert into organizations values ('${org}'), ('${otherOrg}');
    insert into organization_profiles values
      ('${id(10)}', '${org}', 'salesperson',
       '{"gestao":{"subareas":{"commitments":{"manage":false}}}}'),
      ('${id(11)}', '${org}', 'admin', '{}');
  `);
  for (const user of [salesperson, colleague, admin, inactive, superAdmin, profileAdmin]) {
    await db.query('insert into profiles values ($1, $2)', [user, org]);
    const role = user === admin ? 'admin' : user === superAdmin ? 'super_admin' : 'salesperson';
    await db.query('insert into user_roles values ($1, $2)', [user, role]);
    await db.query('insert into organization_members (user_id,organization_id,profile_id,is_active) values ($1, $2, $3, $4)',
      [user, org, user === profileAdmin ? id(11) : id(10), user !== inactive]);
  }
  await db.exec(`
    insert into monthly_commitments (organization_id,user_id,month,total_nifs)
    values ('${org}','${salesperson}','2099-09-01',1),
           ('${org}','${colleague}','2099-09-01',2);
  `);
  if (process.env.P2G_RLS_BASELINE !== '1') await db.exec(await readMigration(fix));
}

async function asUser(db, user, action, role = 'authenticated') {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    await db.exec(`set local role ${role}`);
    return await action();
  } finally {
    await db.exec('rollback');
  }
}

const insert = `insert into monthly_commitments
  (organization_id,user_id,month,total_nifs,total_energia_mwh,total_solar_kwp,total_comissao)
  values ($1,$2,'2099-10-01',5,2000,450,3900) returning total_nifs`;
const denied = (operation) => assert.rejects(operation, (error) => error.code === '42501');

test('monthly commitment ownership policies', async (t) => {
  const db = new PGlite();
  try {
    await setup(db);
    await t.test('commercial user can create their own commitment without manage permission', () =>
      asUser(db, salesperson, async () => {
        const result = await db.query(insert, [org, salesperson]);
        assert.equal(result.rows[0].total_nifs, 5);
      }));
    await t.test('commercial user can upsert an existing own commitment', () =>
      asUser(db, salesperson, async () => {
        const result = await db.query(`insert into monthly_commitments
          (organization_id,user_id,month,total_nifs) values ($1,$2,'2099-09-01',5)
          on conflict (organization_id,user_id,month) do update
          set total_nifs=excluded.total_nifs returning total_nifs`, [org, salesperson]);
        assert.equal(result.rows[0].total_nifs, 5);
      }));
    await t.test('commercial user can update their own commitment', () =>
      asUser(db, salesperson, async () => {
        const result = await db.query('update monthly_commitments set total_nifs=9 where user_id=$1 returning total_nifs', [salesperson]);
        assert.deepEqual(result.rows, [{ total_nifs: 9 }]);
      }));
    await t.test('commercial user can delete their own commitment', () =>
      asUser(db, salesperson, async () => {
        const result = await db.query('delete from monthly_commitments where user_id=$1 returning user_id', [salesperson]);
        assert.equal(result.rows.length, 1);
      }));
    await t.test('commercial user cannot insert for someone else', () =>
      asUser(db, salesperson, () => denied(() => db.query(insert, [org, colleague]))));
    await t.test('commercial user cannot update or delete someone else', () =>
      asUser(db, salesperson, async () => {
        const updated = await db.query('update monthly_commitments set total_nifs=99 where user_id=$1 returning user_id', [colleague]);
        const deleted = await db.query('delete from monthly_commitments where user_id=$1 returning user_id', [colleague]);
        assert.equal(updated.rows.length, 0);
        assert.equal(deleted.rows.length, 0);
      }));
    await t.test('commercial user cannot transfer ownership of their row', () =>
      asUser(db, salesperson, () => denied(() => db.query(
        "update monthly_commitments set user_id=$1, month='2099-12-01' where user_id=$2", [colleague, salesperson]))));
    await t.test('commercial user cannot insert into another organization', () =>
      asUser(db, salesperson, () => denied(() => db.query(insert, [otherOrg, salesperson]))));
    await t.test('commercial user cannot move their row to another organization', () =>
      asUser(db, salesperson, () => denied(() => db.query(
        'update monthly_commitments set organization_id=$1 where user_id=$2', [otherOrg, salesperson]))));
    await t.test('inactive member cannot use the ownership exception', () =>
      asUser(db, inactive, () => denied(() => db.query(insert, [org, inactive]))));
    await t.test('anonymous visitor cannot create commitments', () =>
      asUser(db, null, () => denied(() => db.query(insert, [org, salesperson])), 'anon'));
    for (const [label, user] of [['admin', admin], ['admin profile', profileAdmin]]) {
      await t.test(`${label} retains access to own commitments`, () =>
        asUser(db, user, async () => assert.equal((await db.query(insert, [org, user])).rows.length, 1)));
    }
    await t.test('super admin retains existing access to another user', () =>
      asUser(db, superAdmin, async () => assert.equal((await db.query(insert, [org, colleague])).rows.length, 1)));
    await t.test('ordinary admin does not gain new cross-user permissions', () =>
      asUser(db, admin, () => denied(() => db.query(insert, [org, colleague]))));
    if (process.env.P2G_RLS_BASELINE !== '1') {
      await t.test('migration is repeatable and preserves restrictive policy types', async () => {
        await db.exec(await readMigration(fix));
        const result = await db.query(`select policyname, permissive from pg_policies
          where tablename='monthly_commitments' and policyname like 'perm_write_%'`);
        assert.equal(result.rows.length, 3);
        assert.ok(result.rows.every((row) => row.permissive === 'RESTRICTIVE'));
      });
    }
  } finally {
    await db.close();
  }
});
