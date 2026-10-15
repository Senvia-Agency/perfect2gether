import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const transpile=source=>ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
const utilities={};new Function('exports',transpile(readFileSync('src/lib/leadUtils.ts','utf8')))(utilities);
function conversion(customData,{existing=[],insertError=null,leadError=null,p2g=false,rpcError=null}={}){
 const inserted=[];const invalidated=[];const calls=[];const org=p2g?'96a3950e-31be-4c6d-abed-b82968c0d7e9':'org';
 const source=readFileSync('src/hooks/useClients.ts','utf8').split('\n').filter(line=>!line.startsWith('import ')).join('\n');
 const exports={};const from=table=>{let serial;let inserting=false;const query={select:()=>query,eq:(key,value)=>{if(key==='serial_number')serial=value;return query;},is:()=>query,update:()=>query,insert:value=>{inserting=true;if(table==='cpes')inserted.push(value);return query;},single:async()=>table==='leads'?{data:{assigned_to:'owner',custom_data:customData},error:leadError}:{data:{id:'client'},error:null},maybeSingle:async()=>({data:existing.includes(serial)?{id:'existing'}:null,error:null}),then:resolve=>resolve({data:null,error:table==='cpes'&&inserting?insertError:null})};return query;};
 new Function('exports','useAuth','useMutation','useQueryClient','toast','supabase','getLeadCpes','buildLeadCpesPatch','isPerfect2GetherOrg',transpile(source))(exports,()=>({organization:{id:org,niche:'telecom'}}),options=>options,()=>({invalidateQueries:value=>invalidated.push(value.queryKey)}),{success:()=>{},error:()=>{}},{from,rpc:(name,args)=>({single:async()=>{calls.push({name,args});return {data:{client_id:'client',client_created:false,client_record:{id:'client'}},error:rpcError};}})},utilities.getLeadCpes,utilities.buildLeadCpesPatch,id=>id==='96a3950e-31be-4c6d-abed-b82968c0d7e9');
 return{mutation:exports.useConvertLeadToClient(),inserted,invalidated,calls};
}
const input={lead_id:'lead',name:'Client'};
test('winning a lead transfers every CPE in the current plural format, trimmed and deduplicated',async()=>{
 const run=conversion({cpes:[' PTA ','PTB','PTA',' ']});await run.mutation.mutationFn(input);
 assert.deepEqual(run.inserted.map(row=>row.serial_number),['PTA','PTB']);
 assert.ok(run.inserted.every(row=>row.client_id==='client'&&row.organization_id==='org'));
 run.mutation.onSuccess();assert.ok(run.invalidated.some(key=>key[0]==='cpes'));
});
test('legacy single CPE is retained and an existing client CPE is not duplicated',async()=>{
 const run=conversion({cpe:' PTA '});await run.mutation.mutationFn(input);assert.equal(run.inserted[0].serial_number,'PTA');
 const duplicate=conversion({cpes:['PTA','PTB']},{existing:['PTA']});await duplicate.mutation.mutationFn(input);assert.deepEqual(duplicate.inserted.map(row=>row.serial_number),['PTB']);
});
test('CPE insertion errors and source lead errors cannot produce a successful conversion',async()=>{
 const failure=new Error('CPE insert denied');const run=conversion({cpes:['PTA']},{insertError:failure});await assert.rejects(()=>run.mutation.mutationFn(input),failure);
 const sourceFailure=new Error('Lead unavailable');const source=conversion(null,{leadError:sourceFailure});await assert.rejects(()=>source.mutation.mutationFn(input),sourceFailure);
});
test('P2G conversion routes every client through atomic RPC, with won status and checked failure',async()=>{
 const run=conversion({cpes:['PTA']},{p2g:true});
 const result=await run.mutation.mutationFn({...input,won_status:'won'});
 assert.deepEqual(run.calls,[{name:'convert_p2g_lead_to_client',args:{_lead:'lead',_won_status:'won'}}]);
 assert.equal(result.conversion_created,false);assert.deepEqual(run.inserted,[]);
 const failure=new Error('CPE denied');const denied=conversion(null,{p2g:true,rpcError:failure});
 await assert.rejects(()=>denied.mutation.mutationFn(input),failure);assert.deepEqual(denied.inserted,[]);
});
