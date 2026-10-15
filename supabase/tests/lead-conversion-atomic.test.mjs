import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const org='96a3950e-31be-4c6d-abed-b82968c0d7e9';
const lead='00000000-0000-4000-8000-000000000001';
const client='00000000-0000-4000-8000-000000000002';
async function fixture({existing=false,legacy=false}={}) {
 const db=new PGlite();
 await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function public.p2g_mfa_ok() returns boolean language sql as $$select coalesce(current_setting('test.mfa',true),'true')<>'false'$$;grant usage on schema auth to authenticated;select set_config('test.uid','00000000-0000-4000-8000-000000000099',false);create table organizations(id uuid primary key,niche text);insert into organizations values('${org}','telecom');
 create table leads(id uuid primary key,organization_id uuid,name text,email text,phone text,company_name text,company_nif text,notes text,assigned_to uuid,custom_data jsonb,status text);
 create table crm_clients(id uuid primary key default gen_random_uuid(),organization_id uuid,lead_id uuid,name text,email text,phone text,company text,company_nif text,nif text,notes text,assigned_to uuid,source text,status text,created_at timestamptz default now());
 create table cpes(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,serial_number text,equipment_type text,comercializador text not null,status text,notes text);
 create table proposals(id uuid default gen_random_uuid(),organization_id uuid,lead_id uuid,client_id uuid);
 create table sales(like proposals including defaults);alter table sales add column proposal_id uuid;
 create table pipeline_stages(organization_id uuid,key text,is_final_positive boolean,name text);
 insert into pipeline_stages values('${org}','won',true,'Ganho');
 create function public.can_manage_sales_for_organization(uuid) returns boolean language sql as $$select coalesce(current_setting('test.sales_manage',true),'true')<>'false'$$;
 create function public.has_module_permission(uuid,text,text,text) returns boolean language sql as $$select coalesce(current_setting('test.sales_edit',true),'true')<>'false'$$;
 insert into leads values('${lead}','${org}','Contact','contact@example.test','910000000','Company',' 501234567 ',null,null,'${legacy ? '{"cpe":" pt a "}' : '{"cpes":[" pt a ","PTA"," PTB "," ",null,123]}'}','new');
 insert into proposals(organization_id,lead_id) values('${org}','${lead}');insert into sales(organization_id,lead_id) values('${org}','${lead}');
 alter table leads enable row level security;alter table crm_clients enable row level security;alter table cpes enable row level security;
 create policy visible on leads for all to authenticated using(true) with check(true);create policy visible on crm_clients for all to authenticated using(true) with check(true);create policy visible on cpes for all to authenticated using(true) with check(true);
 grant select,insert,update on all tables in schema public to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261013140000_p2g_cpe_nif_duplicates.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261015080120_p2g_client_nif_cpe_duplicates.sql','utf8'));
 if(existing)await db.exec(`insert into crm_clients(id,organization_id,company_nif,name) values('${client}','${org}','501234567','Existing');insert into cpes(organization_id,client_id,serial_number,equipment_type,comercializador) values('${org}','${client}',' pta ','Energia','Outro');`);
 const migration=readdirSync('supabase/migrations').find(name=>name.endsWith('_p2g_atomic_lead_conversion.sql'));
 if(migration)await db.exec(readFileSync(`supabase/migrations/${migration}`,'utf8'));
 await db.exec('set role authenticated');return db;
}
const convert=db=>db.query('select * from public.convert_p2g_lead_to_client($1,$2)',[lead,'won']);
test('new client conversion atomically transfers normalized CPEs, links history, and marks won; retry reuses it',async()=>{
 // Given an unconverted lead with duplicate and empty CPE values.
 const db=await fixture();try{
 // When conversion is retried after a successful response.
 const first=(await convert(db)).rows[0];const second=(await convert(db)).rows[0];
 // Then one client and each normalized CPE exist, with linked history and won status.
 assert.equal(first.client_id,second.client_id);assert.equal(first.client_created,true);assert.equal(second.client_created,false);
 assert.deepEqual((await db.query('select serial_number from cpes order by serial_number')).rows.map(r=>r.serial_number),['PTA','PTB']);
 assert.equal((await db.query('select count(*)::int count from crm_clients')).rows[0].count,1);
 assert.equal((await db.query('select status from leads')).rows[0].status,'won');
 for(const table of ['proposals','sales'])assert.equal((await db.query(`select client_id from ${table}`)).rows[0].client_id,first.client_id);
 }finally{await db.close();}
});
test('existing fiscal client receives missing CPEs, preserves normalized existing CPE, and supports legacy CPE',async()=>{
 // Given a visible fiscal client with a formatted legacy CPE.
 const db=await fixture({existing:true,legacy:true});try{
 // When the lead is converted.
 const result=(await convert(db)).rows[0];
 // Then the client is reused without duplicating its normalized CPE.
 assert.equal(result.client_id,client);assert.equal(result.client_created,false);assert.equal((await db.query('select count(*)::int count from cpes')).rows[0].count,1);
 }finally{await db.close();}
});
test('denied CPE insert rolls back new client, links, and won status',async()=>{
 // Given existing RLS denies CPE creation.
 const db=await fixture();try{await db.exec('reset role;drop policy visible on cpes;create policy readable on cpes for select to authenticated using(true);set role authenticated');
 // When conversion fails at CPE insertion.
 await assert.rejects(()=>convert(db),/row-level security/);
 // Then no partial conversion is committed.
 assert.equal((await db.query('select count(*)::int count from crm_clients')).rows[0].count,0);assert.equal((await db.query('select status from leads')).rows[0].status,'new');assert.equal((await db.query('select client_id from proposals')).rows[0].client_id,null);
 }finally{await db.close();}
});
test('failed history backfill rolls back all conversion writes',async()=>{
 // Given the sales backfill fails after CPE insertion.
 const db=await fixture();try{await db.exec("reset role;create function fail_write() returns trigger language plpgsql as $$begin raise exception 'sales denied';end$$;create trigger denied before update on sales for each row execute function fail_write();set role authenticated");
 // When conversion reaches that update.
 await assert.rejects(()=>convert(db),/sales denied/);
 // Then the client, CPEs, and earlier proposal update are rolled back.
 assert.equal((await db.query('select count(*)::int count from crm_clients')).rows[0].count,0);assert.equal((await db.query('select count(*)::int count from cpes')).rows[0].count,0);assert.equal((await db.query('select client_id from proposals')).rows[0].client_id,null);assert.equal((await db.query('select status from leads')).rows[0].status,'new');
 }finally{await db.close();}
});
test('existing client gains every missing plural CPE and retry does not duplicate',async()=>{
 const db=await fixture({existing:true});try{
 const first=(await convert(db)).rows[0];await convert(db);
 assert.equal(first.client_id,client);assert.equal(first.client_created,false);
 assert.deepEqual((await db.query('select serial_number from cpes order by serial_number')).rows.map(r=>r.serial_number),[' pta ','PTB']);
 }finally{await db.close();}
});
test('second CPE failure also rolls back the first CPE and created client',async()=>{
 const db=await fixture();try{
 await db.exec("reset role;create function fail_second() returns trigger language plpgsql as $$begin if NEW.serial_number='PTB' then raise exception 'second CPE denied';end if;return NEW;end$$;create trigger denied before insert on cpes for each row execute function fail_second();set role authenticated");
 await assert.rejects(()=>convert(db),/second CPE denied/);
 assert.equal((await db.query('select count(*)::int count from cpes')).rows[0].count,0);assert.equal((await db.query('select count(*)::int count from crm_clients')).rows[0].count,0);
 }finally{await db.close();}
});
test('invisible lead, incomplete MFA, anonymous execution and non-won target cannot convert',async()=>{
 const db=await fixture();try{
 await db.exec("select set_config('test.mfa','false',false)");await assert.rejects(()=>convert(db),/autorizada/);
 await db.exec("select set_config('test.mfa','true',false);reset role;drop policy visible on leads;set role authenticated");await assert.rejects(()=>convert(db),/indisponível/);
 await db.exec("reset role;create policy visible on leads for all to authenticated using(true) with check(true);set role anon");await assert.rejects(()=>convert(db),/permission denied/);
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from public.convert_p2g_lead_to_client($1,$2)',[lead,'lost']),/ganha/);
 assert.equal((await db.query('select count(*)::int count from crm_clients')).rows[0].count,0);
 }finally{await db.close();}
});
test('locked converted proposals and sales without edit permission do not block the permitted conversion',async()=>{
 const db=await fixture();try{
 await db.exec("reset role;update sales set proposal_id=(select id from proposals);create function lock_converted() returns trigger language plpgsql as $$begin if exists(select 1 from sales where proposal_id=NEW.id) and not public.can_manage_sales_for_organization(NEW.organization_id) then raise exception 'converted proposal locked';end if;return NEW;end$$;create trigger locked before update on proposals for each row execute function lock_converted();select set_config('test.sales_edit','false',false);select set_config('test.sales_manage','false',false);revoke update on sales from authenticated;set role authenticated");
 await convert(db);
 assert.equal((await db.query('select status from leads')).rows[0].status,'won');assert.equal((await db.query('select client_id from sales')).rows[0].client_id,null);
 }finally{await db.close();}
});
