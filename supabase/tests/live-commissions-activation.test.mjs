import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {format,endOfMonth} from 'date-fns';
const p2g='96a3950e-31be-4c6d-abed-b82968c0d7e9';
const source=readFileSync('src/hooks/useLiveCommissions.ts','utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
const compiled=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
export const contract={id:'sale1',code:'V-TEST',client_id:'client1',proposal_id:'proposal1',sale_date:'2026-09-20',activation_date:'2026-10-05',status:'delivered'};
export async function commissions(month,{sales=[contract],org=p2g}={}){
  const requests=[];
  const client=createClient('http://127.0.0.1:59999','test-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async input=>{
    const url=new URL(typeof input==='string'?input:input.url);requests.push(url);
    let rows;
    if(url.pathname.endsWith('/sales'))rows=sales.filter(sale=>[...url.searchParams].every(([key,filter])=>{
      if(key==='organization_id'||key==='select')return true;
      const dot=filter.indexOf('.'),op=filter.slice(0,dot),value=filter.slice(dot+1),actual=sale[key];
      if(op==='eq')return actual===value;
      if(op==='gte')return actual!=null&&actual>=value;
      if(op==='lte')return actual!=null&&actual<=value;
      throw Error('Unexpected filter '+filter);
    }));
    else if(url.pathname.endsWith('/crm_clients'))rows=[{id:'client1',assigned_to:'employee1',name:'Cliente de teste',company:'Empresa'}];
    else if(url.pathname.endsWith('/proposals'))rows=[{id:'proposal1',negotiation_type:'angariacao',servicos_produtos:[],servicos_details:null,proposal_type:'energia'}];
    else if(url.pathname.endsWith('/proposal_cpes'))rows=[{id:'cpe1',proposal_id:'proposal1',consumo_anual:209800,dbl:1,duracao_contrato:1,margem:329.67,comissao:329.67,commission_group_id:null,serial_number:'CPE-TEST',contrato_inicio:'2026-10-05',contrato_fim:'2027-10-04'}];
    else throw Error('Unexpected endpoint '+url.pathname);
    return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  }}});
  const exports={};
  new Function('exports','useQuery','supabase','useAuth','useOrganization','useTeamMembers','calculateEnergyCommissionPure','getVolumeTier','format','endOfMonth','isPerfect2GetherOrg',compiled)(exports,options=>options,client,()=>({organization:{id:org}}),()=>({data:{commission_matrix:null}}),()=>({data:[{user_id:'employee1',full_name:'Comercial de teste'}]}),()=>0,kwh=>kwh<=300000?'low':kwh<=600000?'mid':'high',format,endOfMonth,id=>id===p2g);
  const query=exports.useLiveCommissions(month,null);
  return {data:await query.queryFn(),requests,queryKey:query.queryKey};
}
test('September sale activated October5 earns October commission, never September',async()=>{
  const september=await commissions('2026-09-01'),october=await commissions('2026-10-01');
  assert.equal(september.data.totalCommission,0);
  assert.equal(october.data.totalCommission,329.67);
  assert.equal(october.data.globalMwh,209.8);
  assert.equal(october.data.commercials[0].cpes[0].sale_id,'sale1');
});
test('P2G concluded sale without activation date does not fall back to sale month',async()=>{
  const {data}=await commissions('2026-09-01',{sales:[{...contract,activation_date:null}]});assert.equal(data.totalCommission,0);
});
test('activation date cannot make an unconcluded sale commissionable',async()=>{
  const {data}=await commissions('2026-10-01',{sales:[{...contract,status:'in_progress'}]});assert.equal(data.totalCommission,0);
});
test('activation month includes both endpoints and excludes adjacent months across years',async()=>{
  for(const activation_date of ['2026-10-01','2026-10-31'])assert.equal((await commissions('2026-10-01',{sales:[{...contract,activation_date}]})).data.totalCommission,329.67);
  for(const activation_date of ['2026-09-30','2026-11-01'])assert.equal((await commissions('2026-10-01',{sales:[{...contract,activation_date}]})).data.totalCommission,0);
  assert.equal((await commissions('2027-01-01',{sales:[{...contract,activation_date:'2027-01-01'}]})).data.totalCommission,329.67);
});
test('other organizations preserve sale-date commission periods',async()=>{
  assert.equal((await commissions('2026-09-01',{org:'other'})).data.totalCommission,329.67);
  assert.equal((await commissions('2026-10-01',{org:'other'})).data.totalCommission,0);
});
