import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
const migration=fs.readFileSync('supabase/migrations/20261023065350_mj_lead_decision_makers.sql','utf8');
async function setup(){const db=new PGlite();await db.exec('create table leads(id integer,custom_data jsonb);'+migration);return db;}
test('MJ prospect conversion fills one decision maker with both roles and available contacts',async()=>{
 const db=await setup();try{
 const metadata={source_portal:'publicacoes.mj.pt',gerentes:[{nome:' ANA  SILVA ',nif:'123 456 789',cargo:'Gerente'}],socios:[{nome:'Ana Silva',nif:'123456789',cargo:'Sócio',email:'ana@example.test'}]};
 await db.query('insert into leads values(1,$1)',[{prospect_id:'prospect',metadata}]);
 const row=(await db.query('select custom_data from leads')).rows[0].custom_data;
 assert.equal(row.decision_makers.length,1);assert.equal(row.decision_makers[0].name,'ANA SILVA');assert.equal(row.decision_makers[0].role,'Gerente / Sócio');assert.equal(row.decision_makers[0].email,'ana@example.test');assert.deepEqual(row.metadata,metadata);
 }finally{await db.close();}
});
test('names without NIF merge across accents but distinct fiscal identities remain separate',async()=>{
 const db=await setup();try{
 const people={source_portal:'publicacoes.mj.pt',gerentes:[{nome:'José Silva',nif:'111111111'},{nome:'Mesmo Nome',nif:'222222222'}],socios:[{nome:'JOSE SILVA'},{nome:'Mesmo Nome',nif:'333333333'},{nome:'',nif:'444444444'}]};
 await db.query('insert into leads values(1,$1)',[{metadata:people}]);
 const list=(await db.query('select custom_data from leads')).rows[0].custom_data.decision_makers;
 assert.equal(list.length,3);assert.equal(list[0].role,'Gerente / Sócio');
 }finally{await db.close();}
});
test('manual decision makers and non-MJ leads are preserved and old leads are not updated',async()=>{
 const db=await setup();try{
 const manual={decision_makers:[{name:'Manual',role:'Contacto',phone:'',email:''}],metadata:{source_portal:'publicacoes.mj.pt',gerentes:[{nome:'Imported'}]}};
 const other={metadata:{source_portal:'other',gerentes:[{nome:'Ignored'}]}};
 for(const [id,cd] of [[1,manual],[2,other],[3,null]])await db.query('insert into leads values($1,$2)',[id,cd]);
 assert.deepEqual((await db.query('select custom_data from leads order by id')).rows.map(r=>r.custom_data),[manual,other,null]);
 await db.query('update leads set custom_data=$1 where id=2',[{metadata:{source_portal:'publicacoes.mj.pt',socios:[{nome:'Later'}]}}]);
 assert.equal((await db.query('select custom_data from leads where id=2')).rows[0].custom_data.decision_makers,undefined);
 }finally{await db.close();}
});

test('real prospect distribution inserts deduplicated decision makers into the assigned lead',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth;create function auth.uid() returns uuid language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
 create function is_org_member(uuid,uuid) returns boolean language sql as $$select true$$;create function has_role(uuid,text) returns boolean language sql as $$select false$$;
 create function get_org_salespeople(uuid) returns table(user_id uuid,full_name text) language sql as $$select auth.uid(),'Commercial'::text$$;
 create table pipeline_stages(organization_id uuid,key text,position int);
 create table leads(id uuid default gen_random_uuid(),organization_id uuid,name text,email text,phone text,company_name text,company_nif text,consumo_anual numeric,notes text,assigned_to uuid,source text,status text,gdpr_consent boolean,automation_enabled boolean,custom_data jsonb);
 create table prospects(id uuid,organization_id uuid,contact_name text,company_name text,email text,phone text,nif text,annual_consumption_kwh numeric,observations text,cpe text,segment text,source_file_name text,metadata jsonb,assigned_to uuid,assigned_at timestamptz,converted_to_lead boolean default false,converted_lead_id uuid,converted_at timestamptz,status text);`);
 await db.exec(migration+fs.readFileSync('supabase/migrations/20260428144731_fix_prospect_placeholder_email.sql','utf8'));
 await db.query("insert into prospects(id,organization_id,company_name,nif,metadata) values('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Company','999999999',$1)",[{source_portal:'publicacoes.mj.pt',gerentes:[{nome:'Test',nif:'123456789'}],socios:[{nome:'Test',nif:'123456789'}]}]);
 const result=await db.query("select * from distribute_prospects_round_robin('33333333-3333-4333-8333-333333333333',array['22222222-2222-4222-8222-222222222222'::uuid],1)");
 assert.equal(result.rows[0].created_leads_count,1);
 const lead=(await db.query('select * from leads')).rows[0];assert.equal(lead.assigned_to,'11111111-1111-4111-8111-111111111111');assert.equal(lead.custom_data.decision_makers.length,1);assert.equal(lead.custom_data.decision_makers[0].role,'Gerente / Sócio');
 }finally{await db.close();}
});
