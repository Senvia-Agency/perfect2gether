import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
const org='96a3950e-31be-4c6d-abed-b82968c0d7e9';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [bo,sales,admin,other,foreign,inactive]=[1,2,3,4,5,6].map(id);
const migration=readdirSync('supabase/migrations').find(n=>n.endsWith('_p2g_lead_assignment_handoff.sql'));
async function fixture(){
 const db=new PGlite();
 await db.exec(`create schema auth;create role authenticated;create role anon;create role service_role;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select 'authenticated'$$;
 create type app_role as enum('super_admin','admin','salesperson');
 create function has_role(u uuid,r app_role) returns boolean language sql as $$select false$$;
 create function get_user_org_id(u uuid) returns uuid language sql as $$select '${org}'::uuid$$;
 create function app_can_view_user_data(u uuid) returns boolean language sql as $$select u=auth.uid()$$;
 create function p2g_mfa_ok() returns boolean language sql as $$select coalesce(current_setting('test.mfa',true),'true')='true'$$;
 create function has_module_permission(o uuid,m text,s text,a text) returns boolean language sql as $$select coalesce(current_setting('test.'||a,true),'true')='true'$$;
 create table organization_profiles(id uuid,organization_id uuid,base_role app_role,name text);
 create table organization_members(user_id uuid,organization_id uuid,profile_id uuid,is_active boolean);
 create table leads(id uuid primary key default gen_random_uuid(),organization_id uuid not null,name text not null,email text not null,phone text not null,status text default 'new',notes text,source text,value numeric,gdpr_consent boolean not null default false,created_at timestamptz default now(),updated_at timestamptz default now(),custom_data jsonb default '{}',temperature text default 'cold',automation_enabled boolean not null default true,form_id uuid,assigned_to uuid,tipologia text,consumo_anual numeric,company_nif text,company_name text,created_by uuid default auth.uid());
 alter table leads enable row level security;
 create policy "Users read org leads v2" on leads for select to authenticated using(true);
 create policy ins on leads for insert to authenticated with check(organization_id=get_user_org_id(auth.uid()) and has_module_permission(organization_id,'leads','kanban','add'));
 create policy upd on leads for update to authenticated using(organization_id=get_user_org_id(auth.uid()));
 create policy mfa on leads as restrictive for all to authenticated using(p2g_mfa_ok()) with check(p2g_mfa_ok());
 grant usage on schema auth to authenticated;grant select on organization_members,organization_profiles to authenticated;grant select,insert,update on leads to authenticated;`);
 for(const [user,name,base,active,organization] of [[bo,'Back Office','salesperson',true,org],[sales,'Comercial','salesperson',true,org],[admin,'Administrador','admin',true,org],[other,'Comercial','salesperson',true,org],[foreign,'Comercial','salesperson',true,id(90)],[inactive,'Comercial','salesperson',false,org]])await db.query(`insert into organization_profiles values($1,$2,$3,$4);`,[user,organization,base,name]).then(()=>db.query('insert into organization_members values($1,$2,$1,$3)',[user,organization,active]));
 for(const [n,owner] of [[11,bo],[12,null],[13,other],[14,sales]])await db.query('insert into leads(id,organization_id,name,email,phone,assigned_to) values($1,$2,$3,$4,$5,$6)',[id(n),org,'Lead','qa@example.test','123',owner]);
 for(const file of ['20261008190000_p2g_lead_own_visibility.sql','20261008200000_p2g_commercial_lead_visibility.sql','20261008210000_p2g_bo_unassigned_leads.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 if(process.env.LEAD_HANDOFF_BASELINE!=='1')await db.exec(readFileSync(`supabase/migrations/${migration}`,'utf8'));
 await db.exec(`set role authenticated;select set_config('test.uid','${bo}',false);`);
 return db;
}
const create=(db,target=sales,extra={})=> process.env.LEAD_HANDOFF_BASELINE==='1'
 ? db.query('insert into leads(organization_id,name,email,phone,assigned_to) values($1,$2,$3,$4,$5) returning id',[org,'New lead','qa@example.test','123',target])
 : db.query('select create_p2g_assigned_lead($1::jsonb) as id',[JSON.stringify({name:'New lead',email:'qa@example.test',phone:'123',gdpr_consent:true,assigned_to:target,custom_data:{cpes:['PTTEST'],client_segment:'ouro'},...extra})]);
const assign=(db,ids=[id(12)],target=sales)=>process.env.LEAD_HANDOFF_BASELINE==='1'
 ? db.query('update leads set assigned_to=$2 where id=any($1::uuid[]) returning id',[ids,target])
 : db.query('select assign_p2g_leads($1::uuid[],$2::uuid) as count',[ids,target]);
test('BO creates a commercial lead without gaining access to the commercial portfolio',async()=>{
 const db=await fixture();try{
 const created=(await create(db,sales,{organization_id:id(90),created_by:other,status:'won'})).rows[0].id;
 assert.equal((await db.query('select id from leads where id=$1',[created])).rows.length,0);
 await db.exec(`select set_config('test.uid','${sales}',false)`);
 const lead=(await db.query('select * from leads where id=$1',[created])).rows[0];
 assert.equal(lead.organization_id,org);assert.equal(lead.created_by,bo);assert.equal(lead.status,'new');assert.deepEqual(lead.custom_data,{cpes:['PTTEST'],client_segment:'ouro'});
 }finally{await db.close();}
});
test('BO assigns its own and unassigned leads atomically; only the assignee and admin can read them',async()=>{
 const db=await fixture();try{
 assert.equal((await assign(db,[id(11),id(12)])).rows[0].count,2);
 assert.deepEqual((await db.query('select id from leads')).rows,[]);
 await db.exec(`select set_config('test.uid','${sales}',false)`);assert.equal((await db.query('select id from leads')).rows.length,3);
 await db.exec(`select set_config('test.uid','${admin}',false)`);assert.equal((await db.query('select id from leads')).rows.length,4);
 }finally{await db.close();}
});
test('inaccessible, missing and cross-organization leads cannot be assigned, with no partial changes',async()=>{
 const db=await fixture();try{
 for(const bad of [id(13),id(90)])await assert.rejects(assign(db,[id(12),bad]),/permissão/i);
 assert.equal((await db.query('select assigned_to from leads where id=$1',[id(12)])).rows[0].assigned_to,null);
 await db.exec(`reset role;update leads set organization_id='${id(90)}' where id='${id(12)}';set role authenticated;`);await assert.rejects(assign(db),/permissão/i);
 }finally{await db.close();}
});
test('assignment permission, active membership, MFA and eligible destination are mandatory',async()=>{
 const db=await fixture();try{
 for(const target of [foreign,inactive,bo]){await assert.rejects(create(db,target));await assert.rejects(assign(db,[id(12)],target));}
 await db.exec(`select set_config('test.assign','false',false)`);await assert.rejects(create(db));await assert.rejects(assign(db));
 await db.exec(`select set_config('test.assign','true',false);select set_config('test.mfa','false',false)`);await assert.rejects(create(db));await assert.rejects(assign(db));
 await db.exec(`select set_config('test.mfa','true',false);select set_config('test.add','false',false)`);await assert.rejects(create(db));
 await db.exec(`select set_config('test.add','true',false);reset role;update organization_members set is_active=false where user_id='${bo}';set role authenticated;`);await assert.rejects(create(db));await assert.rejects(assign(db));
 }finally{await db.close();}
});
test('anonymous callers cannot invoke either operation',async()=>{
 const db=await fixture();try{
 await db.exec('reset role;set role anon');await assert.rejects(create(db),/permission denied/);await assert.rejects(assign(db),/permission denied/);
 }finally{await db.close();}
});

async function loadHooks(db,organizationId=org){
 const ts=await import('typescript');
 const rpc=async(name,args)=>{
  try{
   const result=name==='create_p2g_assigned_lead'
    ? await db.query('select create_p2g_assigned_lead($1::jsonb) as value',[JSON.stringify(args._lead)])
    : await db.query('select assign_p2g_leads($1::uuid[],$2::uuid) as value',[args._lead_ids,args._assigned_to]);
   return {data:result.rows[0].value,error:null};
  }catch(error){return {data:null,error};}
 };
 const exports={};
 const context={useAuth:()=>({organization:{id:organizationId},user:{id:bo}}),usePermissions:()=>({isAdmin:false,isProfileAdmin:false,isLoadingPermissions:false,profileName:'Back Office'}),useMutation:options=>options,useQueryClient:()=>({invalidateQueries:()=>{}}),useToast:()=>({toast:()=>{}}),supabase:{rpc,from:()=>{throw new Error('A handoff must not use a table readback');}}};
 for(const file of ['src/hooks/useLeads.ts','src/hooks/useBulkAssign.ts']){
  const source=readFileSync(file,'utf8').replace(/^import .*;\r?$/gm,'');
  const js=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
  new Function('exports',...Object.keys(context),js)(exports,...Object.values(context));
 }
 return exports;
}
test('real lead hooks create, individually assign and bulk assign against PostgreSQL',async()=>{
 const db=await fixture();try{
 const hooks=await loadHooks(db);
 const created=await hooks.useCreateLead().mutationFn({name:'Hook lead',email:'qa@example.test',phone:'123',gdpr_consent:true,assigned_to:sales,custom_data:{cpes:['PTTEST']}});
 assert.match(created.id,/^[0-9a-f-]{36}$/);
 await hooks.useUpdateLead().mutationFn({leadId:id(11),updates:{assigned_to:sales}});
 await hooks.useBulkAssignLeads().mutationFn({leadIds:[id(12)],assignedTo:sales});
 assert.equal((await db.query('select id from leads')).rows.length,0);
 await db.exec(`select set_config('test.uid','${sales}',false)`);
 assert.equal((await db.query('select id from leads')).rows.length,4);
 }finally{await db.close();}
});
test('lead hooks propagate failed assignment and do not report success on missing rows',async()=>{
 const db=await fixture();try{
 const hooks=await loadHooks(db);
 await assert.rejects(hooks.useCreateLead().mutationFn({name:'Rejected',email:'qa@example.test',phone:'123',gdpr_consent:true,assigned_to:inactive}));
 await assert.rejects(hooks.useUpdateLead().mutationFn({leadId:id(13),updates:{assigned_to:sales}}));
 await assert.rejects(hooks.useBulkAssignLeads().mutationFn({leadIds:[id(12),id(90)],assignedTo:sales}));
 await assert.rejects(hooks.useUpdateLead().mutationFn({leadId:id(12),updates:{assigned_to:sales,name:'Unrelated edit'}}),/separadamente/);
 }finally{await db.close();}
});
test('admin can reassign a commercial lead while a salesperson cannot reassign another commercial portfolio',async()=>{
 const db=await fixture();try{
 await db.exec(`select set_config('test.uid','${sales}',false)`);await assert.rejects(assign(db,[id(13)]),/permissão/i);
 await db.exec(`select set_config('test.uid','${admin}',false)`);assert.equal((await assign(db,[id(13)])).rows[0].count,1);
 }finally{await db.close();}
});
