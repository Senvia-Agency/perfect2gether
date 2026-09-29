import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = new URL('../migrations/20260929140000_admin_delete_cancelled_p2g_proposal.sql', import.meta.url);
const org = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const admin = '00000000-0000-4000-8000-000000000001';
const commercial = '00000000-0000-4000-8000-000000000002';
const cancelledProposal = '00000000-0000-4000-8000-000000000011';
const activeProposal = '00000000-0000-4000-8000-000000000012';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.organization_members(user_id uuid, organization_id uuid, is_active boolean);
    create table public.user_roles(user_id uuid, role text);
    create table public.proposals(id uuid primary key, organization_id uuid);
    create table public.sales(id uuid primary key, proposal_id uuid references public.proposals(id), organization_id uuid,
      status text, invoicexpress_id bigint, invoice_reference text, credit_note_id int,
      credit_note_reference text, paid_date date, payment_status text);
    create table public.commitment_lines(proposal_id uuid references public.proposals(id));
    create table public.invoices(sale_id uuid references public.sales(id));
    create table public.credit_notes(sale_id uuid references public.sales(id));
    create table public.stripe_commission_records(sale_id uuid references public.sales(id));
    create table public.sale_payments(sale_id uuid references public.sales(id));
    create function public.p2g_mfa_ok() returns boolean language sql stable as $$ select true $$;
    insert into public.organization_members values ('${admin}','${org}',true),('${commercial}','${org}',true);
    insert into public.user_roles values ('${admin}','admin'),('${commercial}','salesperson');
    insert into public.proposals values ('${cancelledProposal}','${org}'),('${activeProposal}','${org}');
    insert into public.sales values
      ('00000000-0000-4000-8000-000000000021','${cancelledProposal}','${org}','cancelled',null,null,null,null,null,'pending'),
      ('00000000-0000-4000-8000-000000000022','${activeProposal}','${org}','fulfilled',null,null,null,null,null,'pending');
    grant usage on schema public,auth to authenticated;
    grant select on public.proposals,public.sales to authenticated;
  `);
  await db.exec(await readFile(migration, 'utf8'));
  return db;
}

async function asUser(db, userId, action) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    await db.exec('set local role authenticated');
    await action();
  } finally {
    await db.exec('rollback');
  }
}

test('only P2G admin can atomically delete a cancelled sale and its proposal', async () => {
  const db = await setup();
  try {
    await asUser(db, commercial, async () => {
      await assert.rejects(() => db.query('select public.delete_cancelled_p2g_proposal($1)', [cancelledProposal]), /Apenas um administrador/);
    });
    await asUser(db, admin, async () => {
      await db.query('select public.delete_cancelled_p2g_proposal($1)', [cancelledProposal]);
      assert.equal((await db.query('select count(*)::int n from public.proposals where id=$1', [cancelledProposal])).rows[0].n, 0);
      assert.equal((await db.query('select count(*)::int n from public.sales where proposal_id=$1', [cancelledProposal])).rows[0].n, 0);
      assert.equal((await db.query('select count(*)::int n from public.proposals where id=$1', [activeProposal])).rows[0].n, 1);
    });
  } finally { await db.close(); }
});

test('active sale remains protected even for administrator', async () => {
  const db = await setup();
  try {
    await asUser(db, admin, async () => {
      await assert.rejects(() => db.query('select public.delete_cancelled_p2g_proposal($1)', [activeProposal]), /venda associada deve estar cancelada/);
    });
  } finally { await db.close(); }
});
