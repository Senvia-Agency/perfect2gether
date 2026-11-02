import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>mocks[name]??require(name),exports);return exports;}
const credits=load('src/lib/api-extraction-credits.ts');
function loadMjHook(creditsModule,remote){
 return load('src/hooks/useProspects.ts',new Proxy({}, {get(_target,key){
 if(key==='@/lib/api-extraction-credits')return creditsModule;
 if(key==='@tanstack/react-query')return {useMutation:options=>options,useQueryClient:()=>({})};
 if(key==='@/contexts/AuthContext')return {useAuth:()=>({organization:{id:'org'}})};
 if(key==='@/integrations/supabase/client')return {supabase:{functions:{invoke:remote}}};
 if(key==='@/lib/invokeFunction')return {invokeFunction:remote};
 return {};
 }}));
}
test('MJ and CRC extractions are unblocked by default',()=>{
 assert.equal(credits.API_EXTRACTIONS_BLOCKED,false);
});
test('MJ extraction reaches the remote API when unblocked',async()=>{
 let calls=0;const remote=()=>{calls++;throw new Error('remote reached');};
 await assert.rejects(loadMjHook(credits,remote).useGenerateMjProspects().mutationFn(),{message:'remote reached'});assert.ok(calls>0);
});
test('MJ extraction rejects for API credits before any remote call when blocked',async()=>{
 let calls=0;const remote=()=>{calls++;throw new Error('Unexpected remote API call');};
 const blocked={...credits,API_EXTRACTIONS_BLOCKED:true};
 await assert.rejects(loadMjHook(blocked,remote).useGenerateMjProspects().mutationFn(),{message:credits.API_CREDITS_MESSAGE});assert.equal(calls,0);
});
test('shared extraction button opens a dialog with the requested message',()=>{
 let open=false;
 const primitive=()=>null;const dialogs=Object.fromEntries(['AlertDialog','AlertDialogAction','AlertDialogContent','AlertDialogDescription','AlertDialogFooter','AlertDialogHeader','AlertDialogTitle'].map(name=>[name,primitive]));
 const {ApiCreditsButton}=load('src/components/ApiCreditsButton.tsx',{'react':{useState:()=>[open,value=>{open=value;}]},'@/components/ui/button':{Button:primitive},'@/components/ui/alert-dialog':dialogs,'@/lib/api-extraction-credits':credits});
 const initial=ApiCreditsButton({children:'Buscar'});assert.equal(initial.props.children[1].props.open,false);
 initial.props.children[0].props.onClick();const result=ApiCreditsButton({children:'Buscar'});assert.equal(result.props.children[1].props.open,true);
 const header=result.props.children[1].props.children.props.children[0];assert.equal(header.props.children[1].props.children,'Precisa de créditos de API para realizar esta tarefa.');
});
