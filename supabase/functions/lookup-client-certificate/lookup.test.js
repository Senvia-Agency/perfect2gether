import { test, expect } from 'bun:test';
import { launchLookup, refreshLookup, lookupResponse } from './lookup.ts';
const item = { id:'00000000-0000-4000-8000-000000000001', provider_run_id:null,status:'RUNNING',phase:'QUEUED',created_at:new Date().toISOString(),checked_at:null,result:null };
function store() {
  let current={...item};
  const updates=[];
  return { updates, from() { return { update(patch) { updates.push(patch); current={...current,...patch}; return { eq() { return { error:null, eq() { return {error:null}; } }; } }; }, select() { return { eq() { return { single:async()=>({data:current,error:null}) }; } }; } }; } };
}
test('queued reservation stays recoverable before background acknowledgement', async()=>{
  const db=store();
  let polls=0;
  const result=await refreshLookup({db,lookup:item,api:{status:async()=>{polls++;}}});
  expect(result.status).toBe('RUNNING');
  expect(result.phase).toBe('QUEUED');
  expect(polls).toBe(0);
  expect(lookupResponse(result).startedAt).toBe(item.created_at);
});
test('background start has one paid attempt even with ambiguous failure',async()=>{
  const db=store(); let paid=0;
  await launchLookup({db,lookup:item,crcCode:'1234-5678-9012',api:{start:async()=>{paid++;throw new Error('ambiguous acknowledgement');}}});
  expect(paid).toBe(1);
  expect(db.updates).toEqual([{status:'FAILED'}]);
});
test('stale queued reservation becomes safely failed without launching',async()=>{
  const db=store();
  const result=await refreshLookup({db,lookup:{...item,created_at:new Date(Date.now()-301000).toISOString()},api:{}});
  expect(result.status).toBe('FAILED');
  expect(lookupResponse(result).error).toContain('Confirme');
});
test('active extraction polls without starting another paid run',async()=>{
  const db=store(); let polls=0;
  const result=await refreshLookup({db,lookup:{...item,phase:'EXTRACTING',provider_run_id:'provider'},api:{status:async()=>{polls++;return {status:'RUNNING'};}}});
  expect(polls).toBe(1);expect(result.status).toBe('RUNNING');
});
test('delayed resume recovers completed provider run with original finished time',async()=>{
  const db=store();
  const checkedAt='2026-10-23T08:00:00.000Z';
  const certificate={nipc:'501234567',denominacao:'Empresa',cae:[],gerentes:[],ok:true,erro:null};
  const result=await refreshLookup({db,lookup:{...item,created_at:new Date(Date.now()-900000).toISOString(),phase:'EXTRACTING',provider_run_id:'provider'},api:{status:async()=>({status:'SUCCEEDED',data:certificate,checkedAt})}});
  expect(result.status).toBe('SUCCEEDED');
  expect(result.checked_at).toBe(checkedAt);
  expect(lookupResponse(result).checkedAt).toBe(checkedAt);
});
