import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const org='96a3950e-31be-4c6d-abed-b82968c0d7e9';
function formHarness(){
 const values=[],effects=[],refs=[];let cursor=0,effectCursor=0,refCursor=0;const saved=[];
 const settings=Object.fromEntries(['name','email','phone','company','company_nif','nif','address','notes'].map(key=>[key,{visible:true,required:false,label:key}]));
 const react={useState(initial){const index=cursor++;if(!(index in values))values[index]=initial;return [values[index],value=>{values[index]=typeof value==='function'?value(values[index]):value;}];},useRef(initial){const index=refCursor++;return refs[index]??=( {current:initial} );},useMemo:fn=>fn(),useEffect(fn,deps){const i=effectCursor++;if(!effects[i]||deps.some((x,j)=>x!==effects[i][j])){effects[i]=deps;fn();}}};
 const mocks={'react':react,'react/jsx-runtime':require('react/jsx-runtime'),'@/hooks/useClients':{useUpdateClient:()=>({isPending:false,mutate:value=>saved.push(value)})},'@/hooks/useClientEdpData':{useSaveClientPeopleRoles:()=>({isPending:false,mutate:value=>saved.push(value)}),useClientPeopleRoles:()=>({data:[],isLoading:false,isError:false}),useClientCertificateHistory:()=>({data:[]})},'@/hooks/useClientLabels':{useClientLabels:()=>({singular:'Cliente'})},'@/hooks/useNifValidation':{useNifValidation:()=>({isDuplicate:false})},'@/hooks/useTeam':{useTeamMembers:()=>({data:[]})},'@/hooks/useClientFieldsSettings':{useClientFieldsSettings:()=>({data:settings})},'@/contexts/AuthContext':{useAuth:()=>({organization:{id:org}})},'@/hooks/usePermissions':{usePermissions:()=>({dataScope:'all'})},'@/hooks/useTeamFilter':{useTeamFilter:()=>({currentUserId:'user',teamMemberIds:[]})},'@/types/clients':{DEFAULT_CLIENT_FIELDS_SETTINGS:settings,CLIENT_SOURCE_LABELS:{direct:'Contacto Direto'}},'@/components/sales/SaleFiscalInfo':{isBillingActive:()=>false},'@/lib/countries':{COUNTRIES:[]},'@/lib/perfect2gether':{isPerfect2GetherOrg:id=>id===org}};
 const loaded={};
 const files={'@/lib/decision-makers':'src/lib/decision-makers.ts','@/lib/client-certificate':'src/lib/client-certificate.ts','./DecisionMakersFields':'src/components/clients/DecisionMakersFields.tsx'};
 mocks['@/hooks/useClientCertificate']={useClientCertificate:()=>({pending:false,error:'',phase:'QUEUED',startedAt:null,elapsedMs:0,notice:'',canResume:false,storageUnavailable:false,lookup:async()=>{},clearRecovery:()=>{}})};
 mocks['@/hooks/useClientFormDraft']={useClientFormDraft:options=>{react.useEffect(()=>options.onInitialize(),[options.open,options.scope]);return {ready:true,restored:false,error:'',clear:()=>{},discard:()=>{}};}};
 const customRequire=name=>{if(mocks[name])return mocks[name];if(name==='zod')return require(name);if(files[name]){if(!loaded[name]){const result={};new Function('require','exports',ts.transpile(fs.readFileSync(files[name],'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}))(customRequire,result);loaded[name]=result;}return loaded[name];}return new Proxy({},{get:(_,key)=>key==='Input'?'input':key==='Button'?'button':'div'});};
 const source=fs.readFileSync('src/components/clients/EditClientModal.tsx','utf8');const js=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX});const exports={};new Function('require','exports',js)(customRequire,exports);
 const client={id:'client',name:'Empresa Exemplo',email:'test@example.pt',phone:'910000000',nif:'502690674',company_nif:'502690674',company:'Empresa Exemplo',status:'active',updated_at:'2026-10-28T10:00:00Z',crc_code:'1234-5678-9012',decision_maker_name:null};
 const render=()=>{cursor=0;effectCursor=0;refCursor=0;return exports.EditClientModal({client,open:true,onOpenChange:()=>{}});};
 const nodes=tree=>{const output=[];function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(typeof node.type==='function'){visit(node.type(node.props));return;}output.push(node);visit(node.props?.children);}visit(tree);return output;};
 render();return {render,nodes,saved};
}
test('editing P2G requires a decision maker and saves it separately without overwriting NIF',()=>{
 const h=formHarness();let tree=h.render();let nodes=h.nodes(tree);const field=nodes.find(n=>n.props?.id==='edit-decision-maker-0-name');assert.ok(field,'mandatory decision-maker field replaces the personal NIF input');assert.equal(field.props.required,true);assert.equal(nodes.some(n=>n.props?.id==='edit-nif'),false);
 let form=nodes.find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});assert.equal(h.saved.length,0,'empty decision maker must not save');
 field.props.onChange({target:{value:'  João Silva  '}});tree=h.render();nodes=h.nodes(tree);const phone=nodes.filter(n=>n.props?.placeholder==='912 345 678'&&typeof n.props?.onChange==='function').at(-1);phone.props.onChange('+351910000001');tree=h.render();nodes=h.nodes(tree);const email=nodes.find(n=>n.props?.id==='edit-decision-maker-0-email');email.props.onChange({target:{value:'joao@example.pt'}});tree=h.render();form=h.nodes(tree).find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});assert.equal(h.saved.length,1);assert.equal(h.saved[0].people[0].name,'João Silva');assert.equal(h.saved[0].patch.company_nif,'502690674');assert.equal('nif' in h.saved[0].patch,false,'stored personal NIF is not overwritten');
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
