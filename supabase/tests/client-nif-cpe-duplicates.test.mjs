import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const org='96a3950e-31be-4c6d-abed-b82968c0d7e9';
const otherOrg='00000000-0000-4000-8000-000000000099';
const one='00000000-0000-4000-8000-000000000001';
const two='00000000-0000-4000-8000-000000000002';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role authenticated;create role anon;alter default privileges grant execute on functions to authenticated,anon;create table crm_clients(id uuid primary key,organization_id uuid,company_nif text,nif text,notes text);create table cpes(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,serial_number text,equipment_type text,notes text);insert into crm_clients values('${one}','${org}','501111111',null,null),('${two}','${org}',null,'502222222',null);`);
 await db.exec(readFileSync('supabase/migrations/20261013140000_p2g_cpe_nif_duplicates.sql','utf8'));
 if(process.env.CLIENT_NIF_BASELINE!=='1'){
  const migration=readdirSync('supabase/migrations').find(name=>name.endsWith('_p2g_client_nif_cpe_duplicates.sql'));
  assert.ok(migration,'client NIF migration exists');
  await db.exec(readFileSync(`supabase/migrations/${migration}`,'utf8'));
 }
 return db;
}
const insert=(db,client=one,serial='PTDUPLICATE')=>db.query("insert into cpes(organization_id,client_id,serial_number,equipment_type) values($1,$2,$3,'Energia')",[org,client,serial]);

test('company NIF and fallback personal NIF edits cannot merge CPE identities',async()=>{
 const db=await fixture();try{
  await insert(db);await insert(db,two,' ptduplicate ');
  for(const assignment of ["company_nif=' 501111111 '","nif='501111111'"]){
   await assert.rejects(()=>db.exec(`update crm_clients set ${assignment} where id='${two}'`),{code:'23505',constraint:'p2g_cpes_nif_serial_unique'});
  }
  assert.equal((await db.query(`select nif from crm_clients where id='${two}'`)).rows[0].nif,'502222222');
 }finally{await db.close();}
});

test('removing a company NIF checks its newly effective fallback NIF',async()=>{
 const db=await fixture();try{
  await db.exec(`update crm_clients set company_nif='503333333',nif='501111111' where id='${two}'`);
  await insert(db);await insert(db,two);
  await assert.rejects(()=>db.exec(`update crm_clients set company_nif='   ' where id='${two}'`),/já existe para este NIF/);
 }finally{await db.close();}
});

test('ordinary users keep updates and hidden CPEs still prevent new conflicts',async()=>{
 const db=await fixture();try{
  await insert(db);await insert(db,two);
  await db.exec(`alter table crm_clients enable row level security;alter table cpes enable row level security;create policy own_client on crm_clients for all to authenticated using(id='${two}') with check(id='${two}');grant select,update on crm_clients to authenticated;grant select on cpes to authenticated;set role authenticated;`);
  await db.exec(`update crm_clients set notes='editado',company_nif='504444444' where id='${two}'`);
  await assert.rejects(()=>db.exec(`update crm_clients set company_nif='501111111' where id='${two}'`),/já existe para este NIF/);
 }finally{await db.close();}
});

test('legacy duplicates, no-op NIF formatting and unused fallback updates stay editable',async()=>{
 const db=await fixture();try{
  await db.exec('alter table cpes disable trigger p2g_cpe_nif_duplicates');
  await insert(db);await insert(db);await insert(db,two);
  await db.exec(`set session_replication_role=replica;update crm_clients set company_nif='501111111' where id='${two}';set session_replication_role=origin`);
  await db.exec('alter table cpes enable trigger p2g_cpe_nif_duplicates');
  await db.exec(`update crm_clients set company_nif=' 501111111 ',nif='999999999',notes='legado' where id='${one}'`);
  await db.exec(`update crm_clients set nif=nif,notes='legado' where id='${two}'`);
  await db.exec(`update crm_clients set company_nif='505555555' where id='${one}'`);
  assert.equal((await db.query('select count(*)::int total from cpes')).rows[0].total,3);
 }finally{await db.close();}
});

test('different CPEs, services, empty serials, missing NIF and other organizations stay allowed',async()=>{
 const db=await fixture();try{
  await insert(db);await insert(db,two,'PTOTHER');
  await db.exec(`insert into cpes(organization_id,client_id,serial_number,equipment_type) values('${org}','${two}','PTDUPLICATE','Serviços'),('${org}','${two}','  ','Energia');update crm_clients set nif='501111111' where id='${two}';update crm_clients set company_nif=null,nif=null where id='${one}';update crm_clients set nif=null where id='${two}';`);
  await db.exec(`update crm_clients set organization_id='${otherOrg}'`);
  await db.exec(`update crm_clients set company_nif='501111111'`);
 }finally{await db.close();}
});


test('client NIF edits hold the exact transaction identity lock used by CPE writes',async()=>{
 const db=await fixture();try{
  await insert(db);
  await db.exec(`begin;update crm_clients set company_nif='506666666' where id='${one}'`);
  const locks=await db.query(`select count(*)::int total from pg_locks where locktype='advisory' and granted and classid::bigint=((hashtextextended($1,0)>>32)&4294967295) and objid::bigint=(hashtextextended($1,0)&4294967295) and objsubid=1`,[`${org}:506666666:PTDUPLICATE`]);
  assert.equal(locks.rows[0].total,1);
  await db.exec('commit');
  await db.exec(`update crm_clients set nif='506666666' where id='${two}'`);
  await assert.rejects(()=>insert(db,two),/já existe para este NIF/);
 }finally{await db.close();}
});

test('CPE writes and competing client edits reject conflicts in either committed order',async()=>{
 const db=await fixture();try{
  await insert(db);await insert(db,two);
  await db.exec(`update crm_clients set company_nif='507777777' where id='${one}'`);
  await assert.rejects(()=>db.exec(`update crm_clients set nif='507777777' where id='${two}'`),/já existe para este NIF/);
  await db.exec(`update crm_clients set nif='508888888' where id='${two}'`);
  await assert.rejects(()=>db.exec(`update crm_clients set company_nif='508888888' where id='${one}'`),/já existe para este NIF/);
 }finally{await db.close();}
});


test('API roles cannot invoke the privileged trigger helper directly',async()=>{
 const db=await fixture();try{
  for(const role of ['anon','authenticated']){
   const result=await db.query("select has_function_privilege($1,'public.p2g_assert_client_nif_cpes()','execute') allowed",[role]);
   assert.equal(result.rows[0].allowed,false);
  }
 }finally{await db.close();}
});
