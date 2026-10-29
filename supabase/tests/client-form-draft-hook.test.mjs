import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const scope = { userId:'00000000-0000-4000-8000-000000000001', organizationId:'96a3950e-31be-4c6d-abed-b82968c0d7e9', formContext:'create' };
const empty = { name:'',email:'',phone:'',company:'',nif:'',decisionMakers:[],legalManagers:[],companyNif:'',crcCode:'',certificateData:null,certificateCheckedAt:null,billingTarget:'client',status:'active',source:'',notes:'',assignedTo:'',addressLine1:'',addressLine2:'',city:'',postalCode:'',country:'PT',distrito:'',conselho:'',grupoEconomico:'' };
function harness() {
  const data = new Map(), writes=[];
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes.push([key,value]);data.set(key,value);},removeItem:key=>data.delete(key)};
  const states=[],refs=[],deps=[],queue=[];let si=0,ri=0,ei=0;
  const react={useState(initial){const i=si++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=value;}];},useRef(initial){const i=ri++;return refs[i]??=( {current:initial} );},useEffect(fn,next){const i=ei++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j])){deps[i]=next;queue.push(fn);}}};
  const modules={};
  function load(path){if(modules[path])return modules[path];const result={};modules[path]=result;const source=fs.readFileSync(path,'utf8');new Function('require','exports','window',ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(name=>name==='react'?react:name==='zod'?require('zod'):name.includes('client-form-persistence')?load('src/lib/client-form-persistence.ts'):name.includes('client-certificate')?load('src/lib/client-certificate.ts'):require(name),result,{localStorage:storage});return result;}
  const persistence=load('src/lib/client-form-persistence.ts');
  const hook=load('src/hooks/useClientFormDraft.ts');let value={...empty};
  return {storage,data,writes,persistence,get value(){return value;},set value(next){value=next;},render(open=true,currentScope=scope){si=ri=ei=0;const result=hook.useClientFormDraft({open,scope:currentScope,value,onRestore:next=>{value=next;},onInitialize:()=>{value={...empty};}});while(queue.length)queue.shift()();return result;}};
}
test('draft hydration restores saved values before any blank overwrite',()=>{
 const h=harness();const saved={...empty,name:'Nome do rascunho',notes:'Não perder',crcCode:'1234-5678-9012'};
 h.persistence.saveClientFormDraft(h.storage,scope,saved);h.writes.length=0;
 h.render();assert.deepEqual(h.value,saved);assert.equal(h.writes.length,0);
 h.render();assert.deepEqual(h.persistence.loadClientFormDraft(h.storage,scope).value,saved);
});
test('closing and reopening recovers edits while successful clear removes recovery',()=>{
 const h=harness();h.render();h.render();h.value={...h.value,notes:'Texto persistente'};h.render();h.render(false);
 h.value={...empty};h.render();h.render();assert.equal(h.value.notes,'Texto persistente');
 const draft=h.render();draft.clear();h.render(false);assert.equal(h.persistence.loadClientFormDraft(h.storage,scope).value,null);
});
test('switching form scope initializes without copying another draft',()=>{
 const h=harness();h.render();h.render();h.value={...h.value,notes:'Só neste cliente'};h.render();
 const other={...scope,formContext:'edit:00000000-0000-4000-8000-000000000002'};
 h.render(true,other);h.render(true,other);assert.equal(h.value.notes,'');assert.equal(h.persistence.loadClientFormDraft(h.storage,other).value,null);
});
test('explicit discard clears saved draft and resets form without recreating it',()=>{
 const h=harness();h.render();h.render();h.value={...h.value,notes:'Descartar'};h.render();
 h.render().discard();h.render();assert.equal(h.value.notes,'');assert.equal(h.persistence.loadClientFormDraft(h.storage,scope).value,null);
});
test('client people drafts preserve identity, provenance and distinct legal-manager assignments',()=>{
 const h=harness();
 const decisionMaker={id:'00000000-0000-4000-8000-000000000010',name:'Pessoa Legada',role:'Diretora',nif:'123456789',phone:'',email:'',source:'legacy',sourceRef:'decision_makers:1',sourceMetadata:{legacy_index:1},roleSource:'legacy'};
 const legalManager={id:decisionMaker.id,name:decisionMaker.name,nif:decisionMaker.nif,phone:'',email:'',source:'mj',sourceRef:'lead:fixture:gerentes:1',sourceMetadata:{legacy_index:1},roleSource:'mj'};
 const saved={...empty,decisionMakers:[decisionMaker],legalManagers:[legalManager]};
 assert.equal(h.persistence.saveClientFormDraft(h.storage,scope,saved).kind,'ready');
 assert.deepEqual(h.persistence.loadClientFormDraft(h.storage,scope).value,saved);
});
