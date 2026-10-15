import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const org='96a3950e-31be-4c6d-abed-b82968c0d7e9';
const otherOrg='00000000-0000-4000-8000-000000000099';
const one='00000000-0000-4000-8000-000000000001';
const two='00000000-0000-4000-8000-000000000002';
const three='00000000-0000-4000-8000-000000000003';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role authenticated;create table crm_clients(id uuid primary key,organization_id uuid,company_nif text,nif text);create table cpes(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,serial_number text,equipment_type text,notes text);insert into crm_clients values('${one}','${org}',' 501234567 ','999999999'),('${two}','${org}',null,'501234567'),('${three}','${org}','509876543','501234567');alter table cpes enable row level security;create policy own_client on cpes for select to authenticated using(client_id='${two}');create policy insert_cpe on cpes for insert to authenticated with check(true);create policy update_cpe on cpes for update to authenticated using(true) with check(true);grant select,insert,update on cpes to authenticated;`);
 if(process.env.CPE_BASELINE!=='1')await db.exec(readFileSync('supabase/migrations/20261013140000_p2g_cpe_nif_duplicates.sql','utf8'));
 return db;
}
const insert=(db,client=one,serial='PT0002000012345678XX',organization=org)=>db.query('insert into cpes(organization_id,client_id,serial_number,equipment_type) values($1,$2,$3,$4)',[organization,client,serial,'Energia']);
test('same CPE and fiscal NIF is blocked within and across client records, including hidden records',async()=>{
 const db=await fixture();try{await insert(db);await assert.rejects(()=>insert(db),/já existe para este NIF/);await db.exec('set role authenticated');await assert.rejects(()=>insert(db,two,' pt0002000012345678xx '),/já existe para este NIF/);}finally{await db.close();}
});
test('company NIF takes precedence and same CPE with different NIF is allowed',async()=>{
 const db=await fixture();try{await insert(db);await insert(db,three);assert.equal((await db.query('select count(*)::int total from cpes')).rows[0].total,2);}finally{await db.close();}
});
test('different CPE is allowed; empty values and missing NIF do not break client records',async()=>{
 const db=await fixture();try{await insert(db);await insert(db,one,'PT0002000099999999XX');await insert(db,one,'');await insert(db,one,null);await db.exec(`update crm_clients set company_nif=null,nif=null where id='${two}'`);await insert(db,two);await assert.rejects(()=>insert(db,two),/já existe para este NIF/);}finally{await db.close();}
});
test('legacy duplicate rows remain intact and editable; changing to a duplicate CPE is blocked',async()=>{
 const db=await fixture();try{await db.exec('alter table cpes disable trigger p2g_cpe_nif_duplicates');await insert(db);await insert(db);await db.exec("alter table cpes enable trigger p2g_cpe_nif_duplicates;update cpes set notes='Preservado',serial_number=serial_number");assert.equal((await db.query('select count(*)::int total from cpes')).rows[0].total,2);await assert.rejects(()=>insert(db));await insert(db,one,'PTDIFFERENT');await assert.rejects(()=>db.query("update cpes set serial_number='PT0002000012345678XX' where serial_number='PTDIFFERENT'"));}finally{await db.close();}
});
test('other organizations and service rows are untouched; cross-organization client links are rejected',async()=>{
 const db=await fixture();try{await db.exec(`insert into crm_clients values('00000000-0000-4000-8000-000000000004','${otherOrg}','501234567',null)`);await insert(db,'00000000-0000-4000-8000-000000000004','PTTEST',otherOrg);await insert(db,'00000000-0000-4000-8000-000000000004','PTTEST',otherOrg);await db.query("insert into cpes(organization_id,client_id,serial_number,equipment_type) values($1,$2,'SERV-1','Serviços'),($1,$2,'SERV-1','Serviços')",[org,one]);await assert.rejects(()=>insert(db,'00000000-0000-4000-8000-000000000004'),/Cliente indisponível/);}finally{await db.close();}
});
