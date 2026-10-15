import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const org = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const actor = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const proposal = '00000000-0000-4000-8000-000000000003';
const meeting = { start_time: '2099-10-20T09:00:00Z', end_time: '2099-10-20T10:00:00Z', meeting_link: 'https://example.test/original' };
const reject = db => db.query('select public.reject_p2g_proposal_with_meeting($1,$2,$3::jsonb) as id', [proposal, 'Preço', JSON.stringify(meeting)]);
const row = async db => (await db.query('select * from proposals where id=$1', [proposal])).rows[0];

async function fixture(beforeMigration) {
  const db = new PGlite();
  await db.exec(`
    create schema auth; create role authenticated; create role anon;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select 'authenticated'$$;
    create function public.p2g_mfa_ok() returns boolean language sql as $$select true$$;
    create table organization_members(user_id uuid,organization_id uuid,is_active boolean);
    create table leads(id uuid primary key,organization_id uuid,status text);
    create table proposals(id uuid primary key,organization_id uuid,created_by uuid,status text,code text,client_id uuid,lead_id uuid);
    create table calendar_events(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,title text,description text,event_type text,start_time timestamptz,end_time timestamptz,client_id uuid,lead_id uuid,status text,meeting_link text);
    insert into organization_members values('${actor}','${org}',true),('${other}','${org}',true);
    insert into proposals values('${proposal}','${org}','${actor}','sent','0001',null,null);
    alter table proposals enable row level security; alter table calendar_events enable row level security;
    create policy own on proposals for all to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
    create policy own_event on calendar_events for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    grant usage on schema auth to authenticated;
    grant select,update on proposals to authenticated;
    grant select,insert,update,delete on calendar_events to authenticated;
    grant select on organization_members to authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/20261013120000_p2g_proposal_rejection_meeting.sql', 'utf8'));
  await db.exec(`set role authenticated; select set_config('test.uid','${actor}',false)`);
  if (beforeMigration) await beforeMigration(db);
  await db.exec('reset role');
  await db.exec('alter default privileges in schema public grant execute on functions to anon, authenticated');
  if (!process.env.REFUSAL_RETENTION_BASELINE) {
    const migration = readdirSync('supabase/migrations').find(name => name.endsWith('_p2g_rejection_audit_retention.sql'));
    assert.ok(migration, 'retention migration exists');
    await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
  }
  await db.exec('set role authenticated');
  return db;
}

test('an audited refusal keeps its reason, live meeting link and immutable snapshot', async () => {
  const db = await fixture();
  try {
    await reject(db);
    for (const assignment of ["rejection_reason=null", "rejection_reason='changed'", 'rejection_meeting_id=null', "rejection_meeting_snapshot='{}'::jsonb"]) {
      await assert.rejects(() => db.exec(`update proposals set ${assignment} where id='${proposal}'`));
    }
    const p = await row(db);
    assert.equal(p.rejection_reason, 'Preço');
    assert.equal(p.rejection_meeting_snapshot.id, p.rejection_meeting_id);
    assert.equal(p.rejection_meeting_snapshot.rejection_reason, 'Preço');
    await db.exec("update proposals set code='0002',status='rejected'");
    assert.equal((await row(db)).code, '0002');
    await db.exec("update proposals set status='sent'");
    await assert.rejects(() => db.exec('update proposals set rejection_reason=null'));
  } finally { await db.close(); }
});

test('the retention trigger preserves original refusal validation and cannot accept forged audit data', async () => {
  const db = await fixture();
  try {
    await assert.rejects(() => db.exec("update proposals set status='rejected',rejection_reason='Preço'"));
    await assert.rejects(() => db.exec("update proposals set rejection_meeting_snapshot='{}'::jsonb"));
    assert.equal((await row(db)).status, 'sent');
    assert.equal((await row(db)).rejection_meeting_snapshot, null);
    await reject(db);
    assert.ok((await row(db)).rejection_meeting_snapshot);
  } finally { await db.close(); }
});

test('calendar completion, rescheduling, editing and deletion retain the original refusal evidence', async () => {
  const db = await fixture();
  try {
    await reject(db);
    const original = await row(db);
    assert.ok(original.rejection_meeting_snapshot);
    await db.exec("update calendar_events set status='completed',title='Edited',description='Edited',start_time='2099-11-01T09:00:00Z',end_time='2099-11-01T10:00:00Z',meeting_link=null");
    assert.deepEqual((await row(db)).rejection_meeting_snapshot, original.rejection_meeting_snapshot);
    await db.exec('delete from calendar_events');
    const retained = await row(db);
    assert.equal(retained.rejection_meeting_id, null);
    assert.equal(retained.rejection_reason, 'Preço');
    assert.deepEqual(retained.rejection_meeting_snapshot, original.rejection_meeting_snapshot);
    assert.equal(retained.rejection_meeting_snapshot.meeting_link, meeting.meeting_link);
    assert.equal(new Date(retained.rejection_meeting_snapshot.start_time).toISOString(), meeting.start_time.replace('Z', '.000Z'));
    await db.exec("update proposals set code='after deletion'");
    await assert.rejects(() => db.exec('update proposals set rejection_reason=null'));
  } finally { await db.close(); }
});

test('a reopened proposal can be refused again while retaining both immutable refusal records', async () => {
  const db = await fixture();
  try {
    await reject(db);
    const original = await row(db);
    await db.exec("update proposals set status='sent'");
    const nextMeeting = { ...meeting, start_time: '2099-12-01T09:00:00Z', end_time: '2099-12-01T10:00:00Z' };
    await db.query('select public.reject_p2g_proposal_with_meeting($1,$2,$3::jsonb)', [proposal, 'Prazo', JSON.stringify(nextMeeting)]);
    const repeated = await row(db);
    assert.equal(repeated.status, 'rejected');
    assert.equal(repeated.rejection_reason, 'Prazo');
    assert.notEqual(repeated.rejection_meeting_id, original.rejection_meeting_id);
    assert.equal(repeated.rejection_meeting_snapshot.rejection_reason, 'Prazo');
    assert.deepEqual(repeated.rejection_meeting_snapshot.previous, original.rejection_meeting_snapshot);
    await assert.rejects(() => db.exec("update proposals set rejection_reason='Tampered'"));
    await assert.rejects(() => db.exec("update proposals set rejection_meeting_snapshot=rejection_meeting_snapshot-'previous'"));
    await db.exec('delete from calendar_events');
    const retained = await row(db);
    assert.equal(retained.rejection_meeting_id, null);
    assert.deepEqual(retained.rejection_meeting_snapshot, repeated.rejection_meeting_snapshot);
  } finally { await db.close(); }
});

test('existing valid refusals are backfilled; historical rows with no meeting stay editable', async () => {
  const db = await fixture(reject);
  try {
    assert.ok((await row(db)).rejection_meeting_snapshot);
    await assert.rejects(() => db.exec('update proposals set rejection_reason=null'));
  } finally { await db.close(); }
  const legacy = await fixture(db => db.exec("reset role;alter table proposals disable trigger require_p2g_rejection_meeting;update proposals set status='rejected';alter table proposals enable trigger require_p2g_rejection_meeting;set role authenticated"));
  try {
    await legacy.exec("update proposals set code='legacy',status='rejected'");
    assert.equal((await row(legacy)).code, 'legacy');
  } finally { await legacy.close(); }
});

test('retention does not expand another user permissions or affect other organizations', async () => {
  const db = await fixture();
  try {
    await reject(db);
    await db.exec(`select set_config('test.uid','${other}',false)`);
    assert.equal((await db.query('update proposals set rejection_reason=null returning id')).rows.length, 0);
    assert.equal((await db.query('delete from calendar_events returning id')).rows.length, 0);
    await db.exec(`reset role;insert into proposals(id,organization_id,created_by,status) values(gen_random_uuid(),'00000000-0000-4000-8000-000000000099','${actor}','rejected');set role authenticated;select set_config('test.uid','${actor}',false);`);
    await db.exec("update proposals set code='other organization' where organization_id<>'96a3950e-31be-4c6d-abed-b82968c0d7e9'");
    const privileges = await db.query("select has_function_privilege('anon','public.retain_p2g_rejection_audit()','EXECUTE') as anon, has_function_privilege('authenticated','public.retain_p2g_rejection_audit()','EXECUTE') as authenticated");
    assert.deepEqual(privileges.rows[0], { anon: false, authenticated: false });
  } finally { await db.close(); }
});
