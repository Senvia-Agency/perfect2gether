import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
test('Supabase default grants do not expose internal triggers or anonymous refusal RPC',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
 alter default privileges in schema public grant execute on functions to anon,authenticated;
 create function public.require_p2g_rejection_meeting() returns trigger language plpgsql as $$begin return new;end;$$;
 create function public.p2g_assert_unique_cpe() returns trigger language plpgsql security definer as $$begin return new;end;$$;
 create function public.p2g_commitment_calendar_month() returns trigger language plpgsql as $$begin return new;end;$$;
 create function public.reject_p2g_proposal_with_meeting(uuid,text,jsonb) returns uuid language sql as $$select $1;$$;
 create table public.fixture(id integer);grant insert,select on fixture to authenticated;
 create trigger first_guard before insert on fixture for each row execute function public.require_p2g_rejection_meeting();
 create trigger second_guard before insert on fixture for each row execute function public.p2g_assert_unique_cpe();
 create trigger third_guard before insert on fixture for each row execute function public.p2g_commitment_calendar_month();`);
 await db.exec(readFileSync('supabase/migrations/20261015073400_p2g_limit_feature_function_execution.sql','utf8'));
 for(const name of ['require_p2g_rejection_meeting()','p2g_assert_unique_cpe()','p2g_commitment_calendar_month()']){
  const {rows}=await db.query('select has_function_privilege($1,$2,$3) anon,has_function_privilege($4,$2,$3) authenticated',['anon','public.'+name,'execute','authenticated']);
  assert.deepEqual(rows,[{anon:false,authenticated:false}]);
 }
 const {rows}=await db.query("select has_function_privilege('anon','public.reject_p2g_proposal_with_meeting(uuid,text,jsonb)','execute') anon,has_function_privilege('authenticated','public.reject_p2g_proposal_with_meeting(uuid,text,jsonb)','execute') authenticated");
 assert.deepEqual(rows,[{anon:false,authenticated:true}]);
 await db.exec('set role authenticated;insert into fixture values(1)');
 assert.deepEqual((await db.query('select id from fixture')).rows,[{id:1}]);
 }finally{await db.close();}
});
