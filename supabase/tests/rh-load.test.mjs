import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../src/lib/rh/load.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { loadRh, RhBackendUnavailableError } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('missing backend is a configuration error, without retrying the request', async () => {
  let calls=0;
  await assert.rejects(loadRh(async()=>{calls++;return {data:null,error:{code:'PGRST202',message:'function not found'}}}), RhBackendUnavailableError);
  assert.equal(calls,1);
});
test('a stuck request ends and its signal is aborted', async () => {
  let signal;
  await assert.rejects(loadRh(s=>{signal=s;return new Promise(()=>{});},20), /não respondeu a tempo/);
  assert.equal(signal.aborted,true);
});
test('configured backend returns real data and preserves authorization errors', async () => {
  const data={records:[{id:'existing-record'}]};
  assert.deepEqual(await loadRh(async()=>({data,error:null})),data);
  await assert.rejects(loadRh(async()=>({data:null,error:{code:'42501',message:'permission denied'}})), /permission denied/);
});
