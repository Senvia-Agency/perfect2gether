import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const exports = {};
new Function('require', 'exports', ts.transpile(fs.readFileSync('src/lib/client-certificate.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(require, exports);
const certificate = { nipc: '501234567', denominacao: 'Empresa Exemplo', cae: [{ codigo: '62010', descricao: 'Programação', principal: true }, { codigo: '62020', descricao: 'Consultoria', principal: false }], gerentes: [{ nome: 'Ana Silva', nif: '123456789' }], ok: true };
test('complete certificate retains principal, secondary CAE and official manager NIF', () => {
  // Given a complete official certificate; when parsed; then structured data survives.
  assert.deepEqual(exports.parseStoredCertificate(certificate), certificate);
});
test('incomplete and failed certificates cannot replace client data', () => {
  for (const value of [null, {}, { ...certificate, nipc: '' }, { ...certificate, ok: false }, { ...certificate, denominacao: '' }]) {
    assert.equal(exports.parseStoredCertificate(value), null);
  }
});
test('CRC is optional for P2G and other organizations', () => {
  assert.equal(exports.certificateRequired(true), false);
  assert.equal(exports.certificateRequired(false), false);
});
test('CRC accepts exactly three groups of four digits', () => {
  assert.equal(exports.CRC_PATTERN.test('1234-5678-9012'), true);
  for (const code of ['', '123456789012', '1234-5678-901', 'abcd-5678-9012']) assert.equal(exports.CRC_PATTERN.test(code), false);
});
test('elapsed import time remains honest without inventing a completion percentage', () => {
  assert.equal(exports.formatCertificateElapsed(0), '0 s');
  assert.equal(exports.formatCertificateElapsed(39_000), '39 s');
  assert.equal(exports.formatCertificateElapsed(61_000), '1 min 1 s');
  assert.equal(exports.formatCertificateElapsed(3_661_000), '1 h 1 min');
});

const persistenceExports = {};
new Function('require', 'exports', ts.transpile(fs.readFileSync('src/lib/client-form-persistence.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(
  name => name === './client-certificate' ? exports : require(name),
  persistenceExports,
);

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

const scope = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  formContext: 'create',
};
const startedAt = '2026-10-23T09:00:00+00:00';
const checkedAt = '2026-10-23T10:00:39+01:00';

function hookHarness(responses, storage = memoryStorage(), blocked = false) {
  const values = [], refs = [], effects = []; let stateIndex=0,refIndex=0,effectIndex=0; const scheduled=[], calls=[];
  const react = {
    useState(initial) { const i=stateIndex++; if (!(i in values)) values[i]=typeof initial === 'function' ? initial() : initial; return [values[i], v=>{values[i]=typeof v === 'function' ? v(values[i]) : v;}]; },
    useRef(initial) { const i=refIndex++; return refs[i] ||= { current: initial }; },
    useEffect(fn,deps) { const i=effectIndex++; const previous=effects[i]; if (!previous || deps.some((v,j)=>v!==previous.deps[j])) { previous?.cleanup?.(); effects[i]={deps,cleanup:fn()}; } },
  };
  const hookExports={};
  const hookRequire=name=>name==='react'?react:name.includes('supabase/client')?{supabase:{functions:{invoke:async (name,{body})=>{calls.push(body);return responses.shift()(body);}}}}:exports;
  const requireWithPersistence = name => name.includes('api-extraction-credits') ? { API_EXTRACTIONS_BLOCKED: blocked, API_CREDITS_MESSAGE: 'Precisa de créditos de API para realizar esta tarefa.' } : name.includes('client-form-persistence') ? persistenceExports : hookRequire(name);
  new Function('require','exports','setTimeout','clearTimeout','setInterval','clearInterval',ts.transpile(fs.readFileSync('src/hooks/useClientCertificate.ts','utf8'), {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(
    requireWithPersistence,
    hookExports,
    (fn, delay)=>{const timer={fn,delay};scheduled.push(timer);return timer;},
    timer=>{const index=scheduled.indexOf(timer);if(index>=0)scheduled.splice(index,1);},
    ()=>({}),
    ()=>{},
  );
  return {
    calls,
    scheduled,
    storage,
    render(open=true,code='1234-5678-9012',onSuccess=()=>{}) {
      globalThis.localStorage = storage;
      stateIndex=refIndex=effectIndex=0;
      return hookExports.useClientCertificate({open,crcCode:code,scope,onSuccess});
    },
    async runNextTimer() {
      const timer=scheduled.shift();
      assert.ok(timer, 'expected a scheduled retry or poll');
      await timer.fn();
      await new Promise(resolve=>setImmediate(resolve));
    },
    unmount() { for (const effect of effects) effect?.cleanup?.(); },
  };
}
test('lookup persists a request id before start and returns the original checkedAt', async () => {
  const h=hookHarness([
    body=>({data:{runId:'run',status:'RUNNING',phase:'EXTRACTING',startedAt}}),
    ()=>({data:{status:'SUCCEEDED',data:certificate,checkedAt,cached:false}}),
  ]);const received=[];
  const onSuccess=(data, timestamp)=>received.push({data,timestamp});
  await h.render(true, '1234-5678-9012', onSuccess).lookup();
  assert.equal(h.render(true, '1234-5678-9012', onSuccess).pending,true);
  const requestId=h.calls[0].requestId;
  assert.match(requestId,/^[0-9a-f-]{36}$/i);
  const recovery=persistenceExports.loadCertificateRecovery(h.storage,scope,'1234-5678-9012');
  assert.equal(recovery.kind,'ready');assert.equal(recovery.value.requestId,requestId);
  await h.runNextTimer();
  assert.deepEqual(h.calls,[
    {action:'start',crcCode:'1234-5678-9012',organizationId:scope.organizationId,requestId},
    {action:'status',runId:'run',organizationId:scope.organizationId},
  ]);
  assert.deepEqual(received,[{data:certificate,timestamp:checkedAt}]);assert.equal(h.render(true, '1234-5678-9012', onSuccess).pending,false);
});

test('refresh after a lost start acknowledgement reuses the persisted request id', async () => {
  const storage=memoryStorage();
  const first=hookHarness([()=>({data:null,error:{message:'ack lost',context:{status:400}}})],storage);
  await first.render().lookup();
  const requestId=first.calls[0].requestId;
  assert.equal(first.render().canResume,true);
  first.unmount();

  const second=hookHarness([()=>({data:{runId:'run-after-reload',status:'RUNNING',phase:'QUEUED',startedAt}})],storage);
  second.render();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(second.calls,[{action:'start',crcCode:'1234-5678-9012',organizationId:scope.organizationId,requestId}]);
});

test('closing the sheet keeps in-memory polling and reopening after unmount resumes by run id', async () => {
  const storage=memoryStorage();
  const first=hookHarness([()=>({data:{runId:'run-close',status:'RUNNING',phase:'EXTRACTING',startedAt}})],storage);
  await first.render().lookup();
  assert.equal(first.scheduled.length,1);
  first.render(false);
  assert.equal(first.scheduled.length,1);
  first.unmount();
  assert.equal(first.scheduled.length,0);

  const received=[];
  const second=hookHarness([()=>({data:{status:'SUCCEEDED',data:certificate,checkedAt,cached:false}})],storage);
  second.render(true,'1234-5678-9012',(data,timestamp)=>received.push({data,timestamp}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(second.calls,[{action:'status',runId:'run-close',organizationId:scope.organizationId}]);
  assert.deepEqual(received,[{data:certificate,timestamp:checkedAt}]);
});

test('success received while closed stays recoverable until the sheet reopens', async () => {
  const received=[];
  const onSuccess=(data,timestamp)=>received.push({data,timestamp});
  const h=hookHarness([
    ()=>({data:{runId:'run-closed-success',status:'RUNNING',phase:'EXTRACTING',startedAt}}),
    ()=>({data:{status:'SUCCEEDED',data:certificate,checkedAt,cached:false}}),
    ()=>({data:{status:'SUCCEEDED',data:certificate,checkedAt,cached:false}}),
  ]);
  await h.render(true,'1234-5678-9012',onSuccess).lookup();
  h.render(false,'1234-5678-9012',onSuccess);
  await h.runNextTimer();
  assert.deepEqual(received,[]);
  assert.notEqual(persistenceExports.loadCertificateRecovery(h.storage,scope,'1234-5678-9012').value,null);

  h.render(true,'1234-5678-9012',onSuccess);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(received,[{data:certificate,timestamp:checkedAt}]);
  assert.equal(persistenceExports.loadCertificateRecovery(h.storage,scope,'1234-5678-9012').value,null);
});

test('a transient transport failure retries the same recoverable request', async () => {
  const h=hookHarness([
    ()=>({data:null,error:{message:'network offline'}}),
    ()=>({data:{runId:'run-retry',status:'RUNNING',phase:'QUEUED',startedAt}}),
  ]);
  await h.render().lookup();
  const requestId=h.calls[0].requestId;
  assert.equal(h.render().pending,true);assert.ok(h.render().notice);assert.equal(h.scheduled.length,1);
  await h.runNextTimer();
  assert.deepEqual(h.calls.map(call=>call.requestId),[requestId,requestId]);
});

test('a 403 pauses for sign-in without clearing the resumable request', async () => {
  const h=hookHarness([()=>({data:null,error:{message:'forbidden',context:{status:403}}})]);
  await h.render().lookup();
  const state=h.render();
  assert.equal(state.pending,false);assert.equal(state.canResume,true);assert.match(state.error,/sessão/i);assert.equal(h.scheduled.length,0);
  assert.notEqual(persistenceExports.loadCertificateRecovery(h.storage,scope,'1234-5678-9012').value,null);
});

test('changing CRC ignores an old in-flight successful result', async () => {
  let finish;const h=hookHarness([()=>new Promise(resolve=>{finish=resolve;})]);const received=[];
  const pending=h.render(true,'1234-5678-9012',(data,timestamp)=>received.push({data,timestamp})).lookup();
  h.render(true,'9999-9999-9999');
  finish({data:{status:'SUCCEEDED',data:certificate,checkedAt,cached:false}});await pending;
  assert.deepEqual(received,[]);assert.equal(h.render(true,'9999-9999-9999').pending,false);
});
test('explicit discard removes recovery metadata and invalidates an in-flight callback', async () => {
  let finish;const h=hookHarness([()=>new Promise(resolve=>{finish=resolve;})]);const received=[];
  const onSuccess=(data,timestamp)=>received.push({data,timestamp});
  const pending=h.render(true,'1234-5678-9012',onSuccess).lookup();
  h.render(true,'1234-5678-9012',onSuccess).clearRecovery();
  assert.equal(persistenceExports.loadCertificateRecovery(h.storage,scope,'1234-5678-9012').value,null);
  finish({data:{status:'SUCCEEDED',data:certificate,checkedAt,cached:false}});await pending;
  assert.deepEqual(received,[]);
});
test('failed lookup preserves existing client data and permits retry', async () => {
  const h=hookHarness([()=>({data:{status:'FAILED',error:'Certidão indisponível'}})]);const received=[];
  await h.render(true,'1234-5678-9012',(data,timestamp)=>received.push({data,timestamp})).lookup();
  assert.deepEqual(received,[]);assert.equal(h.render().pending,false);assert.ok(h.render().error);
});

test('blocked local storage prevents an unrecoverable paid start', async () => {
  const blocked={getItem(){throw new DOMException('blocked','SecurityError');},setItem(){throw new DOMException('blocked','SecurityError');},removeItem(){throw new DOMException('blocked','SecurityError');}};
  const h=hookHarness([],blocked);
  await h.render().lookup();
  assert.equal(h.calls.length,0);assert.equal(h.render().storageUnavailable,true);assert.ok(h.render().error);
});

test('changing an applied CRC clears its autofilled identity and preserves manual edits', () => {
  assert.deepEqual(exports.clearCertificateIdentity({ name: certificate.denominacao, company: certificate.denominacao, companyNif: certificate.nipc }, certificate), { name: '', company: '', companyNif: '' });
  assert.deepEqual(exports.clearCertificateIdentity({ name: 'Nome manual', company: 'Empresa manual', companyNif: '509876543' }, certificate), { name: 'Nome manual', company: 'Empresa manual', companyNif: '509876543' });
});

 test('API credit lock prevents CRC lookup and automatic recovery calls',async()=>{
 const harness=hookHarness([],memoryStorage(),true);
 const hook=harness.render();await hook.lookup();
 assert.equal(harness.calls.length,0);assert.equal(harness.scheduled.length,0);
 assert.equal(harness.render().error,'Precisa de créditos de API para realizar esta tarefa.');
 });
