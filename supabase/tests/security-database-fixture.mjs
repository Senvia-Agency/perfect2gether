import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const org = id(100);
export const otherOrg = id(200);
export const thirdOrg = id(300);
export const fix = '20260914200000_contain_public_security_access.sql';
export const readMigration = (name) => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

async function loadFunction(db, migration, name, delimiter = '$$') {
  const source = await readMigration(migration);
  const start = source.toLowerCase().indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} must exist in repository migration`);
  const end = source.indexOf(`${delimiter};`, start);
  assert.ok(end > start, `${name} function boundary must exist`);
  await db.exec(source.slice(start, end + delimiter.length + 1));
}

export async function setup(db) {
  await db.exec(`
    create role authenticated nologin;
    create role anon nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create type public.app_role as enum ('super_admin','admin','viewer','salesperson');
    create table organizations (id uuid primary key, name text, slug text, meta_pixels jsonb,
      public_key uuid, brevo_api_key text);
    alter table organizations enable row level security;
    create table profiles (id uuid primary key, organization_id uuid);
    create table proposals (id uuid primary key);
    create table sales (id uuid primary key);
    create table user_roles (user_id uuid, role app_role);
    create table organization_profiles (id uuid primary key, organization_id uuid,
      base_role app_role, data_scope text, module_permissions jsonb);
    create table organization_members (user_id uuid, organization_id uuid, profile_id uuid,
      is_active boolean default true, joined_at timestamptz default now(),
      primary key(user_id, organization_id));
    create table teams (id uuid primary key, leader_id uuid);
    create table team_members (team_id uuid, user_id uuid);
    create table forms (id uuid primary key, organization_id uuid, name text, slug text,
      form_settings jsonb, meta_pixels jsonb, is_active boolean, is_default boolean);
    alter table forms enable row level security;
    create function update_updated_at_column() returns trigger language plpgsql as $$
      begin new.updated_at = now(); return new; end
    $$;
  `);
  const initial = '20260107164052_8f035175-4d4f-4623-bd5f-c93d31f5ccd2.sql';
  await loadFunction(db, initial, 'has_role');
  await loadFunction(db, '20260209161039_c1bb6c12-1c6a-44c2-b5a8-c180e1e2926c.sql', 'is_org_member');
  await db.exec(await readMigration('20260309154707_8d9d73d9-6a4d-40de-b2a4-84d9aa5bf95b.sql'));
  await loadFunction(db, '20260525120000_diretor_comercial_data_scope_all.sql', 'app_can_view_user_data', '$function$');
  const organizationPolicies = (await readMigration(initial)).match(/CREATE POLICY "(?:Super admin full access organizations|Users view own organization)"[\s\S]*?;/g);
  assert.equal(organizationPolicies.length, 2);
  await db.exec(organizationPolicies.join('\n'));
  for (const name of [
    '20260116101609_6d10184f-47b5-4ea4-9ed7-a49d42ab5caa.sql',
    '20260303112629_2bb2d95f-ee8f-4f33-8b58-a7fba581c68a.sql',
    '20260303113445_c6d38def-38d7-4f40-ae5b-6fc3b57f108d.sql',
    '20260303114025_b4c898de-7ce3-4ec2-9853-1cfeea060fa8.sql',
    '20260323121611_a4404bea-c8f8-4130-8a96-859c63a603e8.sql',
    '20260624120000_module_permissions_rls.sql',
    '20260914180000_allow_own_monthly_commitments.sql',
  ]) await db.exec(await readMigration(name));
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(new URL('../migrations/', import.meta.url));
  await db.exec(await readMigration(files.find((name) => name.startsWith('20260307125750'))));
  await db.exec(await readMigration(files.find((name) => name.startsWith('20260112161227'))));
  await db.exec(`
    grant usage on schema public, auth to authenticated, anon, service_role;
    grant select, insert, update, delete on all tables in schema public to authenticated, anon, service_role;
    insert into organizations (id,name,slug,public_key,brevo_api_key) values
      ('${org}','Fixture A','fixture-a','${id(101)}','fixture-secret'),
      ('${otherOrg}','Fixture B','fixture-b','${id(201)}','fixture-secret-b'),
      ('${thirdOrg}','Fixture C','fixture-c','${id(301)}','fixture-secret-c');
    insert into forms values ('${id(400)}','${org}','Public form','contact','{}','[]',true,true);
    insert into organization_profiles values
      ('${id(10)}','${org}','salesperson','own','{}'),
      ('${id(11)}','${org}','salesperson','team','{}'),
      ('${id(12)}','${org}','salesperson','all','{}');
  `);
  // Users: own, colleague, team leader, all scope, admin, super admin, multi-org, outsider.
  for (let n = 1; n <= 8; n++) {
    const userOrg = n === 8 ? thirdOrg : org;
    await db.query('insert into profiles values ($1,$2)', [id(n), userOrg]);
    await db.query('insert into user_roles values ($1,$2)', [id(n), n === 5 ? 'admin' : n === 6 ? 'super_admin' : 'salesperson']);
    await db.query('insert into organization_members (user_id,organization_id,profile_id) values ($1,$2,$3)',
      [id(n), userOrg, n === 3 ? id(11) : n === 4 ? id(12) : id(10)]);
    await db.query("insert into monthly_commitments (organization_id,user_id,month) values ($1,$2,'2099-09-01')", [userOrg, id(n)]);
  }
  await db.exec(`
    insert into organization_members (user_id,organization_id,profile_id,is_active) values
      ('${id(7)}','${otherOrg}','${id(10)}',true),
      ('${id(1)}','${otherOrg}','${id(10)}',false);
    insert into teams values ('${id(500)}','${id(3)}');
    insert into team_members values ('${id(500)}','${id(1)}');
    insert into sales values ('${id(600)}');
    insert into stripe_commission_records (organization_id,sale_id,user_id,client_org_id)
      values ('${org}','${id(600)}','${id(1)}','${org}');
    insert into prospect_generation_jobs (id,organization_id,user_id)
      values ('${id(700)}','${org}','${id(1)}');
    insert into commitment_lines (commitment_id,nif)
      select id,'fixture' from monthly_commitments;
  `);
  if (process.env.P2G_SECURITY_BASELINE !== '1') await db.exec(await readMigration(fix));
}

export async function asUser(db, user, action, role = 'authenticated', activeOrg = org) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? '']);
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({app_metadata: {active_organization_id: activeOrg}})]);
    await db.exec(`set local role ${role}`);
    return await action();
  } finally {
    await db.exec('rollback');
  }
}
