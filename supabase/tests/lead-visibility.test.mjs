import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
const p2g='96a3950e-31be-4c6d-abed-b82968c0d7e9';
const own='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const migration=new URL('../migrations/20261008190000_p2g_lead_own_visibility.sql',import.meta.url);
test('P2G own scope hides other and unassigned leads even with a broad existing policy',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth;create role authenticated;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create type public.app_role as enum ('admin','super_admin','salesperson');create table public.user_roles(user_id uuid,role app_role);create function public.has_role(u uuid,r app_role) returns boolean language sql security definer as $$select exists(select 1 from public.user_roles where user_id=u and role=r)$$;create table public.organization_profiles(id uuid,organization_id uuid,base_role app_role);create table public.organization_members(user_id uuid,organization_id uuid,profile_id uuid,is_active boolean);create table public.leads(id int,organization_id uuid,assigned_to uuid);alter table public.leads enable row level security;create policy broad on public.leads for select to authenticated using(true);grant usage on schema auth to authenticated;grant select on public.leads to authenticated;insert into public.organization_profiles values('${own}','${p2g}','salesperson'),('${other}','${p2g}','admin');insert into public.organization_members values('${own}','${p2g}','${own}',true),('${other}','${p2g}','${other}',true);insert into public.leads values(1,'${p2g}','${own}'),(2,'${p2g}','${other}'),(3,'${p2g}',null),(4,'${other}',null);`);
 if(process.env.LEAD_BASELINE!=='1')await db.exec(readFileSync(migration,'utf8'));
 await db.exec(`set role authenticated;select set_config('test.uid','${own}',false);`);
 assert.deepEqual((await db.query('select id from public.leads order by id')).rows.map(x=>x.id),[1,4]);
 await db.exec(`select set_config('test.uid','${other}',false);`);
 assert.equal((await db.query('select id from public.leads')).rows.length,4);
 await db.exec(`reset role;update public.organization_members set is_active=false where user_id='${other}';set role authenticated;`);
 assert.deepEqual((await db.query('select id from public.leads order by id')).rows.map(x=>x.id),[4]);
 }finally{await db.close();}
});

test('lead query enforces own scope except admins and commercial managers, with identity in cache',async()=>{
 const ts=await import('typescript');const source=readFileSync('src/hooks/useLeads.ts','utf8').replace(/^import .*;\r?$/gm,'');const js=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
 for(const [admin,profileName] of [[false,'Comercial'],[false,'Back Office'],[true,'Administrador'],[false,'CE'],[false,'Diretor Comercial']]){
  const manager=profileName==='CE'||profileName==='Diretor Comercial';
  const filters={};let inserted;
  const query={select:()=>query,eq:(k,v)=>{filters[k]=v;return query;},order:()=>query,or:()=>query,insert:value=>{inserted=value;return query;},single:async()=>({data:inserted,error:null}),then:resolve=>resolve({data:[],error:null})};
  const exports={};new Function('exports','useAuth','usePermissions','useTeamFilter','useQuery','useMutation','useQueryClient','useToast','supabase',js)(exports,()=>({user:{id:own},organization:{id:p2g}}),()=>({isAdmin:false,isProfileAdmin:admin,isLoadingPermissions:false,profileName}),()=>({effectiveUserIds:manager?[own]:null}),options=>options,options=>options,()=>({}),()=>({toast:()=>{}}),{from:()=>query});
  const list=exports.useLeads();assert.equal(list.enabled,true);assert.ok(list.queryKey.includes(own));await list.queryFn();assert.equal(filters.assigned_to,admin||manager?undefined:own);
  if(!admin){await exports.useCreateLead().mutationFn({name:'Own lead',gdpr_consent:true});assert.equal(inserted.assigned_to,own);}
 }
});

test('CE and Diretor Comercial see commercial owners across teams but never BO or unassigned leads',async()=>{
 const db=new PGlite();const ids=Array.from({length:5},(_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
 try{
 await db.exec(`create schema auth;create role authenticated;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create type public.app_role as enum ('admin','super_admin','salesperson');create function public.has_role(u uuid,r app_role) returns boolean language sql as $$select false$$;create function public.get_user_org_id(u uuid) returns uuid language sql as $$select '${p2g}'::uuid$$;create function public.app_can_view_user_data(u uuid) returns boolean language sql as $$select u=auth.uid()$$;create table public.organization_profiles(id uuid,organization_id uuid,base_role app_role,name text);create table public.organization_members(user_id uuid,organization_id uuid,profile_id uuid,is_active boolean);create table public.leads(id int,organization_id uuid,assigned_to uuid);alter table public.leads enable row level security;create policy "Users read org leads v2" on public.leads for select to authenticated using(true);grant usage on schema auth to authenticated;grant select on public.leads to authenticated;`);
 for(const [index,name] of ['CE','Diretor Comercial','Comercial','Back Office','Administrador'].entries())await db.exec(`insert into public.organization_profiles values('${ids[index]}','${p2g}','${index===4?'admin':'salesperson'}','${name}');insert into public.organization_members values('${ids[index]}','${p2g}','${ids[index]}',true);insert into public.leads values(${index+1},'${p2g}','${ids[index]}');`);
 await db.exec(`insert into public.leads values(6,'${p2g}',null);`);await db.exec(readFileSync(migration,'utf8'));
 if(process.env.LEAD_COMMERCIAL_BASELINE!=='1')await db.exec(readFileSync(new URL('../migrations/20261008200000_p2g_commercial_lead_visibility.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');
 for(const index of [0,1,2,3,4]){
  await db.exec(`select set_config('test.uid','${ids[index]}',false)`);
  const expected=index<2?[1,2,3]:index===4?[1,2,3,4,5,6]:[index+1];
  assert.deepEqual((await db.query('select id from public.leads order by id')).rows.map(x=>x.id),expected);
 }
 }finally{await db.close();}
});
