import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrations = [
  '../migrations/20260929120000_require_p2g_mfa.sql',
  '../migrations/20260929140000_admin_delete_cancelled_p2g_proposal.sql',
  '../migrations/20260929150000_harden_admin_proposal_deletion.sql',
];
const org = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const admin = '00000000-0000-4000-8000-000000000001';
const commercial = '00000000-0000-4000-8000-000000000002';
const cancelledProposal = '00000000-0000-4000-8000-000000000011';
const activeProposal = '00000000-0000-4000-8000-000000000012';
const cancelledSale = '00000000-0000-4000-8000-000000000021';

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
    create table public.organization_members(user_id uuid, organization_id uuid, role text, is_active boolean);
    create table public.user_roles(user_id uuid, role text);
    create table auth.mfa_factors(id uuid primary key, user_id uuid, factor_type text, status text);
    create table public.leads(id uuid primary key);
    create table public.proposals(id uuid primary key, organization_id uuid);
    create table public.sales(id uuid primary key, proposal_id uuid references public.proposals(id), organization_id uuid,
      status text, invoicexpress_id bigint, invoice_reference text, credit_note_id int,
      credit_note_reference text, paid_date date, payment_status text);
    create table storage.objects(id uuid primary key);
    create table public.commitment_lines(proposal_id uuid references public.proposals(id));
    create table public.invoices(sale_id uuid references public.sales(id));
    create table public.credit_notes(sale_id uuid references public.sales(id));
    create table public.stripe_commission_records(sale_id uuid references public.sales(id));
    create table public.sale_payments(sale_id uuid references public.sales(id) on delete cascade);
    create table public.sale_activation_history(sale_id uuid references public.sales(id) on delete cascade);
    create table public.renewal_automation_runs(sale_id uuid references public.sales(id) on delete cascade);
    alter table public.leads enable row level security;
    alter table public.proposals enable row level security;
    alter table public.sales enable row level security;
    alter table storage.objects enable row level security;
    create policy baseline_proposals on public.proposals for select to authenticated using (true);
    create policy baseline_sales on public.sales for select to authenticated using (true);
    grant usage on schema public,auth,storage to authenticated,anon,service_role;
    grant select on public.proposals,public.sales to authenticated;
    insert into public.organizations values ('${org}');
    insert into public.organization_members values ('${admin}','${org}','admin',true),('${commercial}','${org}','salesperson',true);
    insert into public.user_roles values ('${admin}','admin'),('${commercial}','admin');
    insert into public.proposals values ('${cancelledProposal}','${org}'),('${activeProposal}','${org}');
    insert into public.sales values
      ('${cancelledSale}','${cancelledProposal}','${org}','cancelled',null,null,null,null,null,'pending'),
      ('00000000-0000-4000-8000-000000000022','${activeProposal}','${org}','fulfilled',null,null,null,null,null,'pending');
  `);
  for (const migration of migrations) await db.exec(await readFile(new URL(migration, import.meta.url), 'utf8'));
  return db;
}

async function asUser(db, userId, aal, action) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    await db.query("select set_config('request.jwt.claim.role','authenticated',true)");
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: userId, role: 'authenticated', aal })]);
    await db.exec('set local role authenticated');
    await action();
  } finally {
    await db.exec('rollback');
  }
}

async function expectRejected(db, proposalId, pattern) {
  await db.exec('savepoint rejected');
  try {
    await assert.rejects(() => db.query('select public.delete_cancelled_p2g_proposal($1)', [proposalId]), pattern);
  } finally {
    await db.exec('rollback to savepoint rejected');
  }
}

test('P2G admin atomically deletes a cancelled sale and proposal, preserving active sale', async () => {
  const db = await setup();
  try {
    await asUser(db, admin, 'aal1', async () => {
      await db.query('select public.delete_cancelled_p2g_proposal($1)', [cancelledProposal]);
      assert.equal((await db.query('select count(*)::int n from public.proposals where id=$1', [cancelledProposal])).rows[0].n, 0);
      assert.equal((await db.query('select count(*)::int n from public.sales where proposal_id=$1', [cancelledProposal])).rows[0].n, 0);
      assert.equal((await db.query('select count(*)::int n from public.proposals where id=$1', [activeProposal])).rows[0].n, 1);
    });
  } finally { await db.close(); }
});

test('global admin role without P2G admin membership cannot delete', async () => {
  const db = await setup();
  try {
    await asUser(db, commercial, 'aal1', async () => {
      await expectRejected(db, cancelledProposal, /Apenas um administrador/);
    });
  } finally { await db.close(); }
});

test('active sale, payments, and activation history block deletion', async () => {
  const db = await setup();
  try {
    await asUser(db, admin, 'aal1', async () => {
      await expectRejected(db, activeProposal, /venda associada deve estar cancelada/);
    });
    await db.exec(`insert into public.sale_payments values ('${cancelledSale}')`);
    await asUser(db, admin, 'aal1', async () => {
      await expectRejected(db, cancelledProposal, /venda associada deve estar cancelada/);
    });
    await db.exec('delete from public.sale_payments');
    await db.exec(`insert into public.sale_activation_history values ('${cancelledSale}')`);
    await asUser(db, admin, 'aal1', async () => {
      await expectRejected(db, cancelledProposal, /histórico de ativação/);
    });
  } finally { await db.close(); }
});

test('when P2G MFA becomes mandatory, AAL1 admin is denied and verified AAL2 proceeds', async () => {
  const db = await setup();
  try {
    await db.exec(`update public.organization_security_settings set require_mfa=true where organization_id='${org}'`);
    await asUser(db, admin, 'aal1', async () => {
      await expectRejected(db, cancelledProposal, /2FA verificado/);
    });
    await db.exec(`insert into auth.mfa_factors values ('00000000-0000-4000-8000-000000000031','${admin}','totp','verified')`);
    await asUser(db, admin, 'aal2', async () => {
      await db.query('select public.delete_cancelled_p2g_proposal($1)', [cancelledProposal]);
    });
  } finally { await db.close(); }
});
