import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const org='96a3950e-31be-4c6d-abed-b82968c0d7e9';
function formHarness(){
 const values=[],effects=[];let cursor=0,effectCursor=0;const saved=[];
 const settings=Object.fromEntries(['name','email','phone','company','company_nif','nif','address','notes'].map(key=>[key,{visible:true,required:false,label:key}]));
 const react={useState(initial){const index=cursor++;if(!(index in values))values[index]=initial;return [values[index],value=>{values[index]=value;}];},useMemo:fn=>fn(),useEffect(fn,deps){const i=effectCursor++;if(!effects[i]||deps.some((x,j)=>x!==effects[i][j])){effects[i]=deps;fn();}}};
 const mocks={'react':react,'react/jsx-runtime':require('react/jsx-runtime'),'@/hooks/useClients':{useUpdateClient:()=>({isPending:false,mutate:value=>saved.push(value)})},'@/hooks/useClientLabels':{useClientLabels:()=>({singular:'Cliente'})},'@/hooks/useNifValidation':{useNifValidation:()=>({isDuplicate:false})},'@/hooks/useTeam':{useTeamMembers:()=>({data:[]})},'@/hooks/useClientFieldsSettings':{useClientFieldsSettings:()=>({data:settings})},'@/contexts/AuthContext':{useAuth:()=>({organization:{id:org}})},'@/hooks/usePermissions':{usePermissions:()=>({dataScope:'all'})},'@/hooks/useTeamFilter':{useTeamFilter:()=>({currentUserId:'user',teamMemberIds:[]})},'@/types/clients':{DEFAULT_CLIENT_FIELDS_SETTINGS:settings,CLIENT_SOURCE_LABELS:{direct:'Contacto Direto'}},'@/components/sales/SaleFiscalInfo':{isBillingActive:()=>false},'@/lib/countries':{COUNTRIES:[]},'@/lib/perfect2gether':{isPerfect2GetherOrg:id=>id===org}};
 const customRequire=name=>mocks[name]||new Proxy({},{get:(_,key)=>key==='Input'?'input':key==='Button'?'button':'div'});
 const source=fs.readFileSync('src/components/clients/EditClientModal.tsx','utf8');const js=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX});const exports={};new Function('require','exports',js)(customRequire,exports);
 const client={id:'client',name:'Empresa Exemplo',email:'test@example.pt',phone:'910000000',nif:'502690674',company_nif:'502690674',company:'Empresa Exemplo',status:'active',decision_maker_name:null};
 const render=()=>{cursor=0;effectCursor=0;return exports.EditClientModal({client,open:true,onOpenChange:()=>{}});};
 const nodes=tree=>{const output=[];function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}output.push(node);visit(node.props?.children);}visit(tree);return output;};
 render();return {render,nodes,saved};
}
test('editing P2G requires a decision maker and saves it separately without overwriting NIF',()=>{
 const h=formHarness();let tree=h.render();let nodes=h.nodes(tree);const field=nodes.find(n=>n.props?.id==='edit-decision-maker-name');assert.ok(field,'mandatory decision-maker field replaces the personal NIF input');assert.equal(field.props.required,true);assert.equal(nodes.some(n=>n.props?.id==='edit-nif'),false);
 let form=nodes.find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});assert.equal(h.saved.length,0,'empty decision maker must not save');
 field.props.onChange({target:{value:'  João Silva  '}});tree=h.render();form=h.nodes(tree).find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});assert.equal(h.saved.length,1);assert.equal(h.saved[0].decision_maker_name,'João Silva');assert.equal(h.saved[0].company_nif,'502690674');assert.equal('nif' in h.saved[0],false,'stored personal NIF is not overwritten');
});

test('decision-maker migration preserves legacy tax IDs and old records',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();try{
  await db.exec("create table public.crm_clients(id int,nif text,company_nif text);insert into public.crm_clients values(1,'123456789','987654321');");
  await db.exec(fs.readFileSync('supabase/migrations/20261008210000_client_decision_maker_name.sql','utf8'));
  assert.deepEqual((await db.query('select nif,company_nif,decision_maker_name from public.crm_clients')).rows,[{nif:'123456789',company_nif:'987654321',decision_maker_name:null}]);
  await db.exec("update public.crm_clients set decision_maker_name='João Silva' where id=1");
  assert.deepEqual((await db.query('select nif,company_nif,decision_maker_name from public.crm_clients')).rows,[{nif:'123456789',company_nif:'987654321',decision_maker_name:'João Silva'}]);
 }finally{await db.close();}
});
