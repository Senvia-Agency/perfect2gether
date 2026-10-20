import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/_shared/automation-email.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:module.exports,require:()=>require('zod'),JSON});
const authModule={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/_shared/internal-automation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:authModule.exports,Deno:{env:{get:name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'internal-service':name==='P2G_AUTOMATION_TOKEN'?'database-secret':undefined}},Response});

const {matchesAutomationTrigger:matches,automationEmailWasSent:sent}=module.exports;
test('serialized status rules do not send the contractual email for Entregue or Em progresso',()=>{
 for(const config of [{to_status:'delivered'},JSON.stringify({to_status:'delivered'})]){
  assert.equal(matches(config,{status:'fulfilled'},{status:'in_progress'}),false);
  assert.equal(matches(config,{status:'in_progress'},{status:'fulfilled'}),false);
  assert.equal(matches(config,{status:'delivered'},{status:'fulfilled'}),true);
 }
});
test('Entregue to Em progresso matches the process template, but unchanged or missing required origins do not',()=>{
 assert.equal(matches({from_status:'fulfilled',to_status:'in_progress'},{status:'in_progress'},{status:'fulfilled'}),true);
 assert.equal(matches({from_status:'fulfilled',to_status:'in_progress'},{status:'in_progress'}),false);
 assert.equal(matches({from_status:'fulfilled',to_status:'in_progress'},{status:'fulfilled'},{status:'fulfilled'}),false);
 assert.equal(matches({from_status:'any',to_status:'in_progress'},{status:'in_progress'}),true);
});
test('invalid rules fail closed instead of matching every state',()=>{
 for(const config of ['{invalid',JSON.stringify('bad'),{to_status:42}])assert.throws(()=>matches(config,{status:'fulfilled'}));
});
test('HTTP success with failed, empty, missing or partial provider results is not a sent email',()=>{
 assert.equal(sent({success:true,summary:{total:1,sent:1,failed:0}}),true);
 for(const data of [null,{}, {success:true}, {success:true,summary:{total:1,sent:0,failed:1}},{success:true,summary:{total:0,sent:0,failed:0}}])assert.equal(sent(data),false);
});

function handler(name,{authorization='Bearer internal-service',providerResult={success:true,summary:{total:1,sent:1,failed:0}},transportError=null,config={to_status:'in_progress'}}={}){
 let serve;const calls=[];const updates=[];
 const client={from(table){let patch;const data=table==='organizations'?{brevo_api_key:'provider'}:table==='email_templates'?[{id:'template',automation_trigger_config:config,automation_delay_minutes:0}]:[{id:'item',organization_id:'org',template_id:'template',automation_id:'template',recipient_email:'qa@example.test',variables:{},status:'pending'}];const q={select:()=>q,eq:()=>q,lte:()=>q,limit:()=>q,update:p=>{patch=p;return q;},insert:()=>q,single:async()=>({data,error:null}),then:resolve=>{if(patch)updates.push(patch);return Promise.resolve({data,error:null}).then(resolve);}};return q;},functions:{invoke:async(slug,options)=>{calls.push({slug,...options});return{data:providerResult,error:transportError};}}};
 const compiled=ts.transpileModule(fs.readFileSync(`supabase/functions/${name}/index.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(compiled,{exports:{},require:specifier=>specifier.includes('/http/server')?{serve:fn=>{serve=fn;}}:specifier.includes('supabase-js')?{createClient:()=>client}:specifier.includes('internal-automation')?authModule.exports:module.exports,Deno:{env:{get:name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'internal-service':'https://example.test'}},Request,Response,Headers,console:{log(){},warn(){},error(){}},Date});
 return{calls,updates,run:body=>serve(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify(body)}))};
}
const event={trigger_type:'sale_status_changed',organization_id:'org',record:{id:'sale',status:'in_progress',email:'qa@example.test',name:'QA'},old_record:{status:'fulfilled'}};
test('actual Entregue to Em progresso handler authenticates the send and tags it as automation',async()=>{
 const app=handler('process-automation');const response=await app.run(event);
 assert.equal(response.status,200);assert.equal((await response.json()).triggered,1);
 assert.equal(app.calls[0].headers.Authorization,'Bearer internal-service');assert.equal(app.calls[0].headers.apikey,'internal-service');assert.equal(app.calls[0].body.templateAutomationId,'template');assert.equal(app.calls[0].body.automationId,undefined);
});
test('actual automation handler respects a serialized contractual state rule',async()=>{
 const app=handler('process-automation',{config:JSON.stringify({to_status:'delivered'})});const response=await app.run(event);
 assert.equal((await response.json()).triggered,0);assert.equal(app.calls.length,0);
});
test('actual automation handler reports transport and provider rejections as failures',async()=>{
 for(const options of [{transportError:{message:'401 Unauthorized'}},{providerResult:{success:true,summary:{total:1,sent:0,failed:1}}}]){
  const app=handler('process-automation',options);const response=await app.run(event);const data=await response.json();assert.equal(response.status,502);assert.equal(data.success,false);assert.equal(data.triggered,0);assert.equal(data.failed,1);
 }
});
test('queue handler never marks provider failures as sent',async()=>{
 const app=handler('process-automation-queue',{providerResult:{success:true,summary:{total:1,sent:0,failed:1}}});const response=await app.run({});const data=await response.json();assert.equal(data.sent,0);assert.equal(data.failed,1);assert.equal(app.updates[0].status,'failed');assert.equal(app.calls[0].headers.Authorization,'Bearer internal-service');
});

test('tracking sync keeps watching delivered emails and records Brevo clicks events',async()=>{
 let serve;const filters=[];const patches=[];const client={from(table){let patch;const q={select:()=>q,eq:(...args)=>{filters.push(args);return q;},in:(...args)=>{filters.push(args);return q;},not:()=>q,neq:()=>q,update:value=>{patch=value;return q;},single:async()=>({data:{brevo_api_key:'provider'},error:null}),then:resolve=>{if(patch)patches.push(patch);return Promise.resolve({data:table==='email_sends'?[{id:'email',brevo_message_id:'message',status:'delivered'}]:[],error:null}).then(resolve);}};return q;}};
 const output=ts.transpileModule(fs.readFileSync('supabase/functions/sync-email-statuses/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(output,{exports:{},require:specifier=>specifier.includes('/http/server')?{serve:callback=>{serve=callback;}}:{createClient:()=>client},Deno:{env:{get:()=>''}},Request,Response,console:{log(){},error(){}},setTimeout:callback=>{callback();},fetch:async()=>Response.json({events:[{event:'opened',date:'2026-10-14T10:00:00Z'},{event:'clicks',date:'2026-10-14T10:01:00Z'}]})});
 const response=await serve(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:'org'})}));
 assert.equal((await response.json()).updated,1);assert.ok(filters.some(([key,values])=>key==='status'&&Array.isArray(values)&&values.includes('delivered')));assert.equal(patches[0].opened_at,'2026-10-14T10:00:00Z');assert.equal(patches[0].clicked_at,'2026-10-14T10:01:00Z');
});

test('migration removes the duplicate creation trigger and preserves serialized template conditions',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();try{
 await db.exec(`create table sales(id int,status text);create table observed(op text);create function notify_automation_trigger() returns trigger language plpgsql as $$begin insert into observed values(tg_op);return new;end;$$;create trigger automation_sales_insert after insert on sales for each row execute function notify_automation_trigger();create trigger trigger_automation_sales after insert or update on sales for each row execute function notify_automation_trigger();create table email_templates(organization_id uuid,automation_trigger_config jsonb);`);
 await db.query('insert into email_templates values($1,$2::jsonb)',['96a3950e-31be-4c6d-abed-b82968c0d7e9',JSON.stringify(JSON.stringify({to_status:'delivered'}))]);
 await db.exec(fs.readFileSync('supabase/migrations/20261015104016_p2g_sales_automation_single_insert.sql','utf8'));
 await db.exec("insert into sales values(1,'fulfilled');update sales set status='in_progress' where id=1;");
 assert.deepEqual((await db.query('select op from observed')).rows,[{op:'INSERT'},{op:'UPDATE'}]);assert.deepEqual((await db.query('select automation_trigger_config as config from email_templates')).rows[0].config,{to_status:'delivered'});
 }finally{await db.close();}
});

for (const name of ['process-automation', 'process-automation-queue', 'check-renewal-automations']) {
 test(name + ' rejects public and ordinary-user calls before accessing data or sending', async () => {
  for (const authorization of ['', 'Bearer sb_publishable_public', 'Bearer ordinary-user-jwt']) {
   const app=handler(name,{authorization}); const response=await app.run(event);
   assert.equal(response.status,401); assert.equal(app.calls.length,0); assert.equal(app.updates.length,0);
  }
 });
}

test('dedicated database token passes the actual internal gate while public keys and user tokens do not',()=>{
 for(const headers of [{Authorization:'Bearer internal-service'},{'x-p2g-automation-token':'database-secret'}])assert.equal(authModule.exports.internalAutomationGate(new Request('https://example.test',{headers})),null);
 for(const headers of [{},{Authorization:'Bearer ordinary-user-jwt'},{'x-p2g-automation-token':'wrong'},{Authorization:'Bearer sb_publishable_public'}])assert.equal(authModule.exports.internalAutomationGate(new Request('https://example.test',{headers})).status,401);
});

test('internal-auth migration retrieves the worker token from Vault for actual trigger and cron requests',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();try{
 await db.exec(`create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);insert into vault.decrypted_secrets values('p2g_automation_token','vault-test-token');create schema net;create table observed(headers jsonb,body jsonb);create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin insert into observed values(headers,body);return 1;end;$$;create schema cron;create table cron.jobs(name text,schedule text,command text);create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.jobs values($1,$2,$3);select 1::bigint;$$;create table sales(id int,organization_id uuid,status text);`);
 const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_p2g_internal_automation_auth.sql'));
 await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
 await db.exec(`create trigger test after insert on sales for each row execute function notify_automation_trigger();insert into sales values(1,'96a3950e-31be-4c6d-abed-b82968c0d7e9','in_progress');`);
 const trigger=(await db.query('select headers,body from observed')).rows[0];assert.equal(trigger.headers['x-p2g-automation-token'],'vault-test-token');assert.equal(trigger.body.trigger_type,'sale_created');
 const cron=(await db.query('select command from cron.jobs')).rows[0];await db.exec(cron.command);
 const requests=(await db.query('select headers from observed')).rows;assert.equal(requests.length,2);assert.equal(requests[1].headers['x-p2g-automation-token'],'vault-test-token');
 }finally{await db.close();}
});

test('template automation sends and delayed jobs retain their source with real foreign keys',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try {
  await db.exec(`create table email_templates(id uuid primary key);create table email_automations(id uuid primary key);create table email_sends(id uuid primary key,automation_id uuid references email_automations(id),template_id uuid references email_templates(id));create table automation_queue(id uuid primary key,automation_id uuid NOT NULL references email_automations(id),template_id uuid references email_templates(id));insert into email_templates values('11111111-1111-4111-8111-111111111111');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261020112508_email_template_automation_tracking.sql','utf8'));
  for(const table of ['email_sends','automation_queue']){
   await db.query(`insert into ${table}(id,template_id,template_automation_id) values($1,$2,$2)`,['22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111']);
   const row=(await db.query(`select automation_id,template_automation_id from ${table}`)).rows[0];
   assert.equal(row.automation_id,null);assert.equal(row.template_automation_id,'11111111-1111-4111-8111-111111111111');
  }
  await assert.rejects(db.query("insert into email_sends(id,automation_id) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111')"),/foreign key/);
 } finally {await db.close();}
});
