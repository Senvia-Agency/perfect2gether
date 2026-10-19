import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const org = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const read = name => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
const fix = '20261019130427_allow_p2g_commercial_director_delete_proposals.sql';

// Removing the director DELETE grant must fail the allowed-director case;
// broadening it must fail the non-director, inactive, permission and org cases.
test('proposal DELETE respects director permission without changing other operations', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated nologin;
      create role anon nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create schema storage;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
      create function auth.jwt() returns jsonb language sql stable as $$
        select current_setting('request.jwt.claims',true)::jsonb $$;
      create type public.app_role as enum ('admin','super_admin','salesperson','viewer');
      create table public.organizations(id uuid primary key);
      create table public.user_roles(user_id uuid, role public.app_role);
      create table public.organization_profiles(id uuid primary key, organization_id uuid,
        name text, base_role public.app_role, module_permissions jsonb);
      create table public.organization_members(user_id uuid,organization_id uuid,profile_id uuid,is_active boolean);
      create table public.proposals(id uuid primary key,organization_id uuid);
      create table public.sales(id uuid primary key,proposal_id uuid,organization_id uuid);
      create table public.proposal_cpes(id uuid primary key,proposal_id uuid);
      create table public.leads(id uuid primary key);
      create table storage.objects(id uuid primary key);
      create table auth.mfa_factors(user_id uuid,factor_type text,status text);
      create function public.has_role(u uuid,r public.app_role) returns boolean language sql stable
        security definer set search_path='' as $$
          select exists(select 1 from public.user_roles where user_id=u and role=r) $$;
      create function public.get_user_org_id(u uuid) returns uuid language sql stable
        security definer set search_path='' as $$
          select organization_id from public.organization_members where user_id=u limit 1 $$;
      grant usage on schema auth,public to authenticated;
      grant select on public.organization_members,public.organization_profiles to authenticated;
      grant select,insert,update,delete on public.proposals to authenticated;
      alter table public.proposals enable row level security;
      alter table public.leads enable row level security;
      alter table public.sales enable row level security;
      alter table storage.objects enable row level security;
      create policy proposal_read on public.proposals for select to authenticated
        using (organization_id=public.get_user_org_id(auth.uid()));
      insert into public.organizations values ('${org}');
      insert into public.proposals values ('${id(100)}','${org}'),('${id(101)}','${id(999)}');
    `);
    const baseline = await read('20260114164459_b1b6be10-b60d-481b-98ae-6d946db18d81.sql');
    for (const name of ['Admins delete org proposals', 'Super admin full access proposals']) {
      const policy = baseline.match(new RegExp(String.raw`CREATE POLICY "${name}"[\s\S]*?;`));
      assert.ok(policy);
      await db.exec(policy[0]);
    }
    await db.exec(await read('20260624120000_module_permissions_rls.sql'));
    await db.exec(await read('20260929120000_require_p2g_mfa.sql'));
    await db.exec(await read('20260923151000_lock_converted_proposals_for_salespeople.sql'));
    await db.exec(`update public.organization_security_settings set require_mfa=true`);
    const cases = [
      ['Diretor Comercial', true, true, 'salesperson', 'aal2', org, 1],
      ['Administrador', true, true, 'admin', 'aal2', org, 1],
      ['Suporte', true, true, 'super_admin', 'aal2', org, 1],
      ['Comercial', true, true, 'salesperson', 'aal2', org, 0],
      ['CE', true, true, 'salesperson', 'aal2', org, 0],
      ['Back Office', true, true, 'salesperson', 'aal2', org, 0],
      ['Financeiro', true, true, 'salesperson', 'aal2', org, 0],
      ['Visualizador', true, true, 'viewer', 'aal2', org, 0],
      ['Diretor Comercial', false, true, 'salesperson', 'aal2', org, 0],
      ['Diretor Comercial', true, false, 'salesperson', 'aal2', org, 0],
      ['Diretor Comercial', true, true, 'salesperson', 'aal1', org, 0],
      ['Diretor Comercial', true, true, 'salesperson', 'aal2', id(999), 0],
    ];
    for (const [index, [name, allowed, active, role, aal, targetOrg, expected]] of cases.entries()) {
      const user = id(index + 1);
      const profile = id(index + 200);
      await db.query('insert into public.organization_profiles values ($1,$2,$3,$4,$5)',
        [profile,org,name,role === 'super_admin' ? 'admin' : role,
          JSON.stringify({ proposals:{subareas:{proposals:{delete:allowed}}} })]);
      await db.query('insert into public.organization_members values ($1,$2,$3,$4)', [user,org,profile,active]);
      await db.query('insert into public.user_roles values ($1,$2)', [user,role]);
      await db.query("insert into auth.mfa_factors values ($1,'totp','verified')", [user]);
    }
    if (process.env.P2G_DIRECTOR_DELETE_BASELINE !== '1') await db.exec(await read(fix));
    for (const [index, [name, allowed, active, role, aal, targetOrg, expected]] of cases.entries()) {
      await t.test(`${name}: permission=${allowed}, active=${active}, ${aal}, org=${targetOrg}`, async () => {
        await db.exec('begin');
        try {
          await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id(index+1)]);
          await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({aal})]);
          await db.exec('set local role authenticated');
          const result = await db.query('delete from public.proposals where organization_id=$1 returning id', [targetOrg]);
          assert.equal(result.rows.length, expected);
        } finally { await db.exec('rollback'); }
      });
    }
    await t.test('director cannot change proposals or delete converted proposals', async () => {
      await db.exec(`insert into public.sales values ('${id(700)}','${id(100)}','${org}')`);
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id(1)]);
        await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({aal:'aal2'})]);
        await db.exec('set local role authenticated');
        const result = await db.query('update public.proposals set organization_id=organization_id returning id');
        assert.equal(result.rows.length,0);
        await assert.rejects(db.query('delete from public.proposals where id=$1 returning id',[id(100)]), /convertida em venda/);
      } finally { await db.exec('rollback'); }
    });
  } finally { await db.close(); }
});
