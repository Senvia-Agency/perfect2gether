import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createECDH} from 'node:crypto';
const source=fs.readFileSync('src/lib/push-subscription.ts','utf8');
const compiled=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
const {ensurePushSubscription,subscriptionUsesKey}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const key=Uint8Array.from([4,12,45]).buffer;
const encoded=Buffer.from(key).toString('base64url');
test('matching key keeps existing subscription without replacing device registration',async()=>{
 const sub={options:{applicationServerKey:key}};
 assert.equal(subscriptionUsesKey(sub,encoded),true);
 const result=await ensurePushSubscription({getSubscription:async()=>sub,subscribe:async()=>assert.fail('must not subscribe')},encoded);
 assert.equal(result,sub);
});
test('old key is unsubscribed and renewed with exact current public key',async()=>{
 const events=[];const sub={options:{applicationServerKey:new Uint8Array([3]).buffer},unsubscribe:async()=>{events.push('unsubscribe');return true;}};
 const renewed={endpoint:'new'};
 const result=await ensurePushSubscription({getSubscription:async()=>sub,subscribe:async options=>{events.push('subscribe');assert.equal(options.userVisibleOnly,true);assert.deepEqual(new Uint8Array(options.applicationServerKey),new Uint8Array(key));return renewed;}},encoded);
 assert.equal(result,renewed);assert.deepEqual(events,['unsubscribe','subscribe']);
});
test('failed unsubscribe blocks replacement instead of claiming notifications active',async()=>{
 const sub={options:{applicationServerKey:new Uint8Array([3]).buffer},unsubscribe:async()=>false};
 await assert.rejects(ensurePushSubscription({getSubscription:async()=>sub,subscribe:async()=>assert.fail('must not subscribe')},encoded),/renovar/);
});
test('parallel shell and settings renewal share one browser subscription operation',async()=>{
 let count=0;const manager={getSubscription:async()=>null,subscribe:async()=>{count++;return {endpoint:'new'};}};
 const [a,b]=await Promise.all([ensurePushSubscription(manager,encoded),ensurePushSubscription(manager,encoded)]);
 assert.equal(a,b);assert.equal(count,1);
});
test('VAPID public key matches frontend and backend fallback and is valid P-256',()=>{
 const frontend=fs.readFileSync('src/lib/push-key.ts','utf8').match(/'([^']+)'/)[1];
 const backend=fs.readFileSync('supabase/functions/send-push-notification/index.ts','utf8').match(/VAPID_PUBLIC_KEY[^\n]+\|\| '([^']+)'/)[1];
 assert.equal(frontend,backend);
 const ecdh=createECDH('prime256v1');ecdh.generateKeys();
 assert.equal(ecdh.computeSecret(Buffer.from(frontend,'base64url')).length,32);
});
test('opening another organization cannot auto-renew an opt-in from the previous organization',async()=>{
 const hookSource=fs.readFileSync('src/hooks/usePushNotifications.ts','utf8').replace(/^import .*;\r?$/gm,'');
 const hookJs=ts.transpile(hookSource,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
 let renewed=0;const filters={};
 const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query;},maybeSingle:async()=>({data:filters.organization_id==='org-b'?null:{id:'old-registration'},error:null})};
 const subscription={endpoint:'existing-device'};
 const react={useState:value=>[value,()=>{}],useEffect:effect=>effect(),useCallback:callback=>callback};
 const fakeWindow={PushManager:{},Notification:{},btoa};
 const args=['exports','useState','useEffect','useCallback','useAuth','useToast','supabase','navigator','window','Notification','VAPID_PUBLIC_KEY','ensurePushSubscription','subscriptionUsesKey'];
 new Function(...args,hookJs+';exports.usePushNotifications();')({},react.useState,react.useEffect,react.useCallback,()=>({user:{id:'own'},organization:{id:'org-b'}}),()=>({toast:()=>{}}),{from:()=>query},{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>subscription}})}},fakeWindow,{permission:'granted'},encoded,async()=>{renewed++;throw new Error('Unexpected auto-renewal across organizations');},()=>false);
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(renewed,0);assert.equal(filters.organization_id,'org-b');
});
