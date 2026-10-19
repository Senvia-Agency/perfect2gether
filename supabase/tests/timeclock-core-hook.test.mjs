import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
const domain={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/modules/timeclock/workday.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:domain,Intl,Date});
function fixture(send, locate=async()=>null, enabled=true) {
 let authUser='user';
 const states=[],refs=[],store=new Map(),requests=[]; let si=0,ri=0;
 const key=k=>JSON.stringify(k);
 const initial={entries:[],holidays:[]};
 const client={invalidateQueries:async()=>{},cancelQueries:async()=>{},getQueryData:k=>store.get(key(k)),setQueryData:(k,value)=>store.set(key(k),typeof value==='function'?value(store.get(key(k))):value)};
 class ClockApiError extends Error { constructor(code,message,retryable=false){super(message);this.code=code;this.retryable=retryable;} }
 const react={useState(value){const index=si++;if(!(index in states))states[index]=value;return [states[index],value=>states[index]=typeof value==='function'?value(states[index]):value];},useRef(value){return refs[ri++]??=( {current:value} );},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect:()=>{}};
 const exports={};
 const compiled=ts.transpileModule(readFileSync('src/modules/timeclock/useTimeClock.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(compiled,{exports,require(name){
 if(name.includes('useReleaseFeatures'))return {useReleaseFeatures:()=>({features:{timeclock:enabled}})};
 if(name==='react')return react;
 if(name.includes('react-query'))return {useQueryClient:()=>client,useQuery:options=>{if(!store.has(key(options.queryKey)))store.set(key(options.queryKey),structuredClone(initial));return {data:store.get(key(options.queryKey)),isLoading:false,error:null};}};
 if(name.includes('AuthContext'))return {useAuth:()=>({user:{id:authUser},organization:{id:'org'}})};
 if(name==='./api')return {ClockApiError,clockApi:{punch:async input=>{requests.push(input);return send(input,ClockApiError);}}};
 if(name==='./geolocation')return {getBestPosition:locate,warmupGeolocation:()=>{}};
 if(name==='./workday')return {...domain,currentMonth:()=> '2026-10'};
 return {};
 },Date,Error,crypto:{randomUUID},localStorage:{getItem:()=> 'device'}});
 return {switchUser(){authUser="other";},render(){si=0;ri=0;return exports.useTimeClock();},requests,store};
}
test('Given a transport failure, when retrying, then request identity remains stable and optimistic row rolls back',async()=>{
 let calls=0;
 const f=fixture(async(input,Failure)=>{if(++calls===1)throw new Failure('network','Offline',true);return {entry:{id:input.request_id},duplicate:true};});
 const hook=f.render(); await assert.rejects(hook.punch('start'));
 assert.equal([...f.store.values()][0].entries.length,0);
 await f.render().retry();
 assert.equal(f.requests[0].request_id,f.requests[1].request_id);
});
test('Given an in-flight punch, when another starts, then only one request reaches transport',async()=>{
 let finish, started; const ready=new Promise(resolve=>{started=resolve;}); const f=fixture(input=>new Promise(resolve=>{finish=()=>resolve({entry:{id:input.request_id},duplicate:false});started();}));
 const first=f.render().punch('start');
 await assert.rejects(f.render().punch('start'),error=>error.code==='busy');
 await ready; assert.equal(f.render().state.status,'working'); finish(); await first;
 assert.equal(f.requests.length,1);
});
test('Given a definitive rejection, when retrying, then no duplicate request is sent',async()=>{
 const f=fixture(async(_,Failure)=>{throw new Failure('invalid_state','Invalid state');});
 await assert.rejects(f.render().punch('start'));
 await assert.rejects(f.render().retry(),error=>error.code==='no_retry');
 assert.equal(f.requests.length,1);
});



test('Given identity changes while GPS waits, when locating finishes, then old intent is never sent under new authentication',async()=>{
 let finish; const locate=new Promise(resolve=>{finish=resolve;});
 const f=fixture(async()=>({}),()=>locate);const pending=f.render().punch('start');
 f.switchUser();f.render();finish(null);
 await assert.rejects(pending,error=>error.code==='identity_changed');assert.equal(f.requests.length,0);
});


test('Given disabled point, when punching, then no transport request is sent', async () => {
 const f=fixture(async()=>({}), async()=>null, false);
 await assert.rejects(f.render().punch('start'), /desativado/);
 assert.equal(f.requests.length, 0);
});
