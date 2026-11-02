import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const org='96a3950e-31be-4c6d-abed-b82968c0d7e9',actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',proposal='00000000-0000-4000-8000-000000000003';
async function fixture(){const db=new PGlite();await db.exec(`create schema auth;create role authenticated;create role anon;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function auth.role() returns text language sql as $$select 'authenticated'$$;create function public.p2g_mfa_ok() returns boolean language sql as $$select coalesce(current_setting('test.mfa',true),'true')<>'false'$$;create table public.organization_members(user_id uuid,organization_id uuid,is_active boolean);create table public.crm_clients(id uuid primary key);create table public.leads(id uuid primary key,organization_id uuid,status text);create table public.proposals(id uuid primary key,organization_id uuid,created_by uuid,status text,code text,client_id uuid,lead_id uuid);create table public.calendar_events(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,title text,description text,event_type text,start_time timestamptz,end_time timestamptz,client_id uuid,lead_id uuid,status text,meeting_link text);insert into organization_members values('${actor}','${org}',true),('${other}','${org}',true);insert into proposals values('${proposal}','${org}','${actor}','sent','0001',null,null);alter table proposals enable row level security;alter table calendar_events enable row level security;create policy own on proposals for all to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());create policy own_event on calendar_events for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());grant usage on schema auth to authenticated;grant select,update on proposals to authenticated;grant select,insert on calendar_events to authenticated;grant select on organization_members to authenticated;`);
await db.exec(readFileSync('supabase/migrations/20261013120000_p2g_proposal_rejection_meeting.sql','utf8'));
await db.exec(`alter table crm_clients add column organization_id uuid, add column company text, add column name text, add column company_nif text, add column nif text;alter table leads add column company_name text, add column name text, add column company_nif text;alter table calendar_events add column reminder_minutes integer;grant select on crm_clients,leads to authenticated;grant update on calendar_events to authenticated;insert into crm_clients values('00000000-0000-4000-8000-000000000004','${org}','Empresa Exemplo','Contacto Exemplo','500000001','200000001');update proposals set client_id='00000000-0000-4000-8000-000000000004';`);
await db.exec(readFileSync('supabase/migrations/20261102091923_p2g_rejection_meeting_company_reminder.sql','utf8'));await db.exec(`set role authenticated;select set_config('test.uid','${actor}',false);`);return db;}
const meeting={start_time:'2099-10-20T09:00:00Z',end_time:'2099-10-20T10:00:00Z',meeting_link:null};
const reject=(db,reason='Preço',values=meeting)=>db.query('select public.reject_p2g_proposal_with_meeting($1,$2,$3::jsonb)',[proposal,reason,JSON.stringify(values)]);

test('refusal meeting includes company identity and keeps a reminder after editing',async()=>{
 const db=await fixture();try{
 await reject(db);await reject(db);
 let events=(await db.query('select * from calendar_events')).rows;
 assert.equal(events.length,1);assert.match(events[0].title,/Empresa Exemplo/);
 assert.equal(events[0].description,`Empresa: Empresa Exemplo
NIF: 500000001
Motivo da recusa: Preço`);
 assert.equal(events[0].reminder_minutes,15);
 await db.exec('update calendar_events set reminder_minutes=null');
 assert.equal((await db.query('select reminder_minutes from calendar_events')).rows[0].reminder_minutes,15);
 await db.exec('update calendar_events set reminder_minutes=30');
 events=(await db.query('select * from calendar_events')).rows;
 assert.equal(events[0].reminder_minutes,30);assert.equal(events[0].description.match(/Empresa:/g).length,1);
 }finally{await db.close();}
});
test('lead company is used when no client exists and ordinary events stay unchanged',async()=>{
 const db=await fixture();try{
 await db.exec(`reset role;insert into leads values('00000000-0000-4000-8000-000000000005','${org}','negotiation','Empresa Lead','Pessoa','500000002');update proposals set client_id=null,lead_id='00000000-0000-4000-8000-000000000005';set role authenticated;`);
 await reject(db);
 const event=(await db.query('select * from calendar_events')).rows[0];
 assert.match(event.description,/Empresa: Empresa Lead[^]*NIF: 500000002/);
 await db.query('insert into calendar_events(organization_id,user_id,title,event_type) values($1,$2,$3,$4)',[org,actor,'Reunião normal','meeting']);
 const normal=(await db.query("select * from calendar_events where title='Reunião normal'")).rows[0];
 assert.equal(normal.reminder_minutes,null);assert.equal(normal.description,null);
 }finally{await db.close();}
});
