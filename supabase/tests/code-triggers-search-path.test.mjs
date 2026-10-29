import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const org='96a3950e-31be-4c6d-abed-b82968c0d7e9';

// Generators and triggers as they exist in production before the fix (20260115135121 + 20260121114016).
async function fixture(){
 const db=new PGlite();
 await db.exec(`
 create table public.crm_clients(id uuid primary key default gen_random_uuid(),organization_id uuid,name text,code text unique);
 create table public.proposals(id uuid primary key default gen_random_uuid(),organization_id uuid,code text unique);
 create table public.sales(id uuid primary key default gen_random_uuid(),organization_id uuid,code text unique);
 ${['client:crm_clients','proposal:proposals','sale:sales'].map(pair=>{const [kind,table]=pair.split(':');return `
 create function generate_${kind}_code(_org_id uuid) returns text as $$
 declare _count integer; begin
  select coalesce(max(cast(nullif(regexp_replace(code,'[^0-9]','','g'),'') as integer)),0)+1 into _count from ${table} where organization_id=_org_id and code is not null;
  return lpad(_count::text,4,'0'); end; $$ language plpgsql security definer set search_path = public;
 create function set_${kind}_code() returns trigger as $$
 begin if new.code is null then new.code := generate_${kind}_code(new.organization_id); end if; return new; end; $$ language plpgsql;
 create trigger trigger_set_${kind}_code before insert on ${table} for each row execute function set_${kind}_code();`;}).join('\n')}
 create function public.insert_with_empty_search_path(p_table text) returns text language plpgsql security definer set search_path = '' as $$
 declare result text; begin
  execute format('insert into public.%I(organization_id) values(%L) returning code',p_table,'${org}') into result;
  return result; end $$;`);
 return db;
}

const insertCode=(db,table)=>db.query('select public.insert_with_empty_search_path($1) as code',[table]).then(r=>r.rows[0].code);

test('code triggers fail inside functions with an empty search_path before the fix',async()=>{
 const db=await fixture();try{
 await assert.rejects(insertCode(db,'crm_clients'),/generate_client_code\(uuid\) does not exist/);
 }finally{await db.close();}
});

test('code triggers assign sequential codes regardless of the caller search_path after the fix',async()=>{
 // Given the production triggers and the fix migration.
 const db=await fixture();try{
 await db.exec(readFileSync('supabase/migrations/20261029120000_code_triggers_search_path.sql','utf8'));
 // When rows are inserted directly and from SECURITY DEFINER functions with search_path = ''.
 await db.exec(`insert into crm_clients(organization_id) values('${org}')`);
 // Then every insert gets the next code.
 assert.equal(await insertCode(db,'crm_clients'),'0002');
 assert.equal(await insertCode(db,'proposals'),'0001');
 assert.equal(await insertCode(db,'sales'),'0001');
 }finally{await db.close();}
});
