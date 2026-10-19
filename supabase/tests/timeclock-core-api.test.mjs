import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
function load(name,client){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(`src/modules/timeclock/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,require(id){if(id.includes('supabase/client'))return {supabase:client};if(id==='./types')return load('types',client);return require(id);}});return exports;}
for(const [code,raw,category] of [['PGRST202','Could not find public.p2g_clock','backend_unavailable'],['P0001','invalid_state','invalid_state'],['P0001','invalid_manual_time','manual_time'],['P0001','own_entry_forbidden','access'],['P0001','invalid_nfc','nfc'],['','Failed to fetch','network']]){
 test(`Given ${code||'transport'} ${raw}, when RPC fails, then user error has normalized ${category} category`,async()=>{
  const {clockApi}=load('api',{rpc:async()=>({error:{code,message:raw},data:null})});
  await assert.rejects(clockApi.call('snapshot',{org:'org'}),error=>error.code===category&&error.message!==raw);
 });
}
test('Given an overlong note, when punching, then validation rejects before transport',async()=>{
 let calls=0;const {clockApi}=load('api',{functions:{invoke:async()=>{calls++;return {data:{},error:null};}}});
 await assert.rejects(clockApi.punch({note:'x'.repeat(301)}));assert.equal(calls,0);
});
test('Given static NFC token without counter, when parsing options, then counter remains optional',()=>{
 const {punchOptionsSchema}=load('types',{});const result=punchOptionsSchema.parse({tag:{id:'tag',token:'secret'}});assert.equal(result.tag.counter,undefined);
});
test('Given secure NFC data without counter, when parsing options, then replay protection input is rejected',()=>{
 const {punchOptionsSchema}=load('types',{});assert.equal(punchOptionsSchema.safeParse({tag:{id:'tag',picc_data:'encrypted',cmac:'mac'}}).success,false);
});
test('Given a three-hundred-character note, when parsing options, then exact maximum remains accepted',()=>{
 const {punchOptionsSchema}=load('types',{});assert.equal(punchOptionsSchema.safeParse({note:'x'.repeat(300)}).success,true);
});
test('Given configured report identity, when snapshot is parsed, then company identity remains available to exports',()=>{
 const {snapshotSchema}=load('types',{});const identity={name:'Empresa',nif:'123456789',logo_url:null};
 const snapshot={server_now:'2026-10-19T12:00:00Z',timezone:'Europe/Lisbon',can_manage:false,can_configure:false,entries:[],people:[],locations:[],tags:[],schedules:[],holidays:[],history:[],notifications:[],report_identity:identity};
 assert.deepEqual(snapshotSchema.parse(snapshot).report_identity,identity);
 const {report_identity,...missing}=snapshot;assert.equal(snapshotSchema.safeParse(missing).success,false);
});
