import test from 'node:test';
import assert from 'node:assert/strict';
import { createClockDatabase,clockIds as i,clockSession,clockRpc,clockPunch } from './timeclock-database-fixture.mjs';

const uuid=()=>crypto.randomUUID();
const ago=seconds=>new Date(Date.now()-seconds*1000).toISOString();
const admin=(op,extra={})=>({org:i.org,op,user:i.employee,reason:'Correção validada',...extra});
async function root(db) {await db.exec('RESET ROLE');}
async function seedEntry(db,user,action,at,status='valid') {
 await root(db);
 return (await db.query(`INSERT INTO p2g_clock_entries(organization_id,user_id,action,entry_type,kind,punched_at,status,source)
 VALUES($1,$2,$3,$4,$5,$6,$7,'gps') RETURNING id`,[i.org,user,action,['start','resume'].includes(action)?'in':'out',action==='pause'?'pause':'work',at,status])).rows[0].id;
}

test('actual attendance migration, privileges, state machine and audit',async t=>{
 const db=await createClockDatabase();
 t.after(()=>db.close());
 await t.test('employee only sees self; RH and legacy portal privileges do not imply management',async()=>{
  await clockSession(db);
  const snapshot=await clockRpc(db,'snapshot',{});
  assert.equal(snapshot.can_manage,false);assert.equal(snapshot.can_configure,false);
  assert.equal(snapshot.people.length,1);assert.equal(snapshot.people[0].id,i.employee);
  await assert.rejects(clockRpc(db,'snapshot',{user:i.manager}),/access_denied/);
  await assert.rejects(clockRpc(db,'entry_manage',admin('create',{action:'start',at:ago(200)})),/manage_required/);
 });
 await t.test('anonymous, cross organization and inactive members cannot access',async()=>{
  await clockSession(db,null,'anon');await assert.rejects(clockRpc(db,'snapshot',{}),/permission denied/);
  await clockSession(db,i.stranger);await assert.rejects(clockRpc(db,'snapshot',{}),/access_denied/);
  await clockSession(db,i.inactive);await assert.rejects(clockRpc(db,'snapshot',{}),/access_denied/);
  await clockSession(db,i.employee);await assert.rejects(clockRpc(db,'snapshot',{org:i.otherOrg}),/access_denied/);
  await assert.rejects(db.query('SELECT p2g_clock_context($1,$2)',[i.org,i.employee]),/permission denied/);
  await assert.rejects(db.query('SELECT p2g_clock_worker($1,$2)',['claim',{}]),/permission denied/);
 });
 await t.test('direct writes and secret column reads denied',async()=>{
  await assert.rejects(db.query('INSERT INTO p2g_clock_entries DEFAULT VALUES'),/permission denied/);
  await assert.rejects(db.query('SELECT metadata FROM p2g_clock_entries'),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM p2g_clock_tags'),/permission denied/);
  await assert.rejects(db.query('UPDATE p2g_clock_history SET reason=$1',['bad']),/permission denied/);
 });
 let start,pause,resume,stop;
 await t.test('manual future, too old, missing reason and wrong first action reject',async()=>{
  await clockSession(db,i.employee,'service_role');
  await assert.rejects(clockPunch(db,'pause'),/invalid_state/);
  await assert.rejects(clockPunch(db,'start',{at:new Date(Date.now()+10000).toISOString(),note:'Esquecimento'}),/invalid_manual_time/);
  await assert.rejects(clockPunch(db,'start',{at:ago(43201),note:'Esquecimento'}),/invalid_manual_time/);
  await assert.rejects(clockPunch(db,'start',{at:ago(600),note:'12!'}),/reason_required/);
 });
 await t.test('valid ordered punches, stable request id and concurrent retries',async()=>{
  const request=uuid();start=await clockPunch(db,'start',{request_id:request,at:ago(300),note:'Esqueci registo'});
  assert.equal(start.entry.status,'pending');assert.ok(start.entry.flags.includes('manual_time'));assert.equal(start.entry.corrected,true);
  const retries=await Promise.all([clockPunch(db,'start',{request_id:request}),clockPunch(db,'start',{request_id:request})]);
  assert.ok(retries.every(x=>x.duplicate&&x.entry.id===start.entry.id));
  assert.equal((await clockPunch(db,'start')).duplicate,true);
  const context=(await db.query('SELECT p2g_clock_context($1,$2,$3) AS r',[i.org,i.employee,request])).rows[0].r;
  assert.equal(context.duplicate.entry.id,start.entry.id);
  pause=await clockPunch(db,'pause',{at:ago(200),note:'Almoço registado'});
  resume=await clockPunch(db,'resume',{at:ago(100),note:'Regresso registado'});
  stop=await clockPunch(db,'stop');assert.equal(stop.entry.action,'stop');
  assert.equal(Object.hasOwn(stop.entry,'metadata'),false);
 });
 await t.test('resume-day converts previous stop into audited pause transactionally',async()=>{
  await root(db);await db.query("UPDATE p2g_clock_entries SET created_at=now()-interval '61 seconds' WHERE organization_id=$1",[i.org]);
  const result=await clockPunchAfterSession(db,'resume');assert.equal(result.duplicate,false);
  await root(db);const prior=(await db.query('SELECT action,corrected FROM p2g_clock_entries WHERE id=$1',[stop.entry.id])).rows[0];
  assert.equal(prior.action,'pause');assert.equal(prior.corrected,true);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM p2g_clock_history WHERE action='resume_day'")).rows[0].n,1);
 });
 await t.test('audit is immutable and entries cannot be deleted even by owner',async()=>{
  await root(db);
  await assert.rejects(db.query('UPDATE p2g_clock_history SET reason=$1',['tamper']),/immutable_attendance_record/);
  await assert.rejects(db.query('DELETE FROM p2g_clock_history'),/immutable_attendance_record/);
  await assert.rejects(db.query('DELETE FROM p2g_clock_entries'),/immutable_attendance_record/);
 });
 await t.test('manager cannot create, edit, approve, void or restore own entries',async()=>{
  const own=await seedEntry(db,i.manager,'start',ago(500));await clockSession(db,i.manager);
  for(const op of ['create','edit','approve','reject','void','restore']) await assert.rejects(clockRpc(db,'entry_manage',admin(op,{id:own,user:i.manager,action:'start',at:ago(600)})),/own_entry_forbidden/);
 });
 await t.test('manager mutations validate full resulting sequence, including restore',async()=>{
  await assert.rejects(clockRpc(db,'entry_manage',admin('create',{action:'start',at:ago(50)})),/invalid_state/);
  await assert.rejects(clockRpc(db,'entry_manage',admin('void',{id:pause.entry.id})),/invalid_state/);
  const approved=await clockRpc(db,'entry_manage',admin('approve',{id:start.entry.id}));assert.equal(approved.status,'valid');assert.equal(approved.corrected,true);
  const voided=await seedEntry(db,i.employee,'start',ago(20),'voided');await clockSession(db,i.manager);
  await assert.rejects(clockRpc(db,'entry_manage',admin('restore',{id:voided})),/invalid_state/);
 });
 await t.test('employee direct RLS filters own records and snapshot strips metadata',async()=>{
  await clockSession(db);const direct=await db.query('SELECT user_id FROM p2g_clock_entries');assert.ok(direct.rows.every(x=>x.user_id===i.employee));
  const snap=await clockRpc(db,'snapshot',{});assert.ok(snap.entries.every(x=>x.user_id===i.employee&&!Object.hasOwn(x,'metadata')));
  assert.ok(snap.history.every(x=>x.entry_id!==null&&!Object.hasOwn(x.after??{},'metadata')));
 });
 await t.test('configuration is separate from manage; locations remain organization scoped',async()=>{
  const location={name:'Sede',latitude:38.7,longitude:-9.1,radius_m:50,max_accuracy_m:100,gps_only:false,block_vpn:true,trusted_ips:['127.0.0.1'],is_active:true,reason:'Local autorizado'};
  await clockSession(db,i.manager);await assert.rejects(clockRpc(db,'location_save',location),/configure_required/);
  await clockSession(db,i.config);const saved=await clockRpc(db,'location_save',location);
  await assert.rejects(clockRpc(db,'entry_manage',admin('approve',{id:start.entry.id})),/access_denied/);
  await assert.rejects(clockRpc(db,'location_save',{...location,org:i.otherOrg,id:saved.id}),/access_denied/);
  await clockSession(db);assert.deepEqual((await clockRpc(db,'snapshot',{})).locations[0].trusted_ips,[]);
  await clockSession(db,i.config);assert.deepEqual((await clockRpc(db,'snapshot',{})).locations[0].trusted_ips,['127.0.0.1']);
 });
 await t.test('report identity defaults to organization; only configurator can save with audited reason',async()=>{
  await clockSession(db);assert.deepEqual((await clockRpc(db,'snapshot',{})).report_identity,{name:'Local P2G',nif:'',logo_url:null});
  const settings={name:'Empresa Legal',nif:'123456789',logo_url:'https://example.com/logo.png',reason:'Identidade confirmada'};
  await assert.rejects(clockRpc(db,'settings_save',settings),/configure_required/);
  await clockSession(db,i.manager);await assert.rejects(clockRpc(db,'settings_save',settings),/configure_required/);
  await clockSession(db,i.config);
  await assert.rejects(clockRpc(db,'settings_save',{...settings,org:i.otherOrg}),/access_denied/);
  await assert.rejects(clockRpc(db,'settings_save',{...settings,reason:'1!'}),/reason_required/);
  await assert.rejects(clockRpc(db,'settings_save',{...settings,nif:'123'}),/check constraint/);
  assert.equal((await clockRpc(db,'settings_save',settings)).nif,'123456789');
  await clockSession(db);assert.equal((await clockRpc(db,'snapshot',{})).report_identity.name,'Empresa Legal');
  await clockSession(db,i.manager);const audit=(await clockRpc(db,'snapshot',{})).history.find(x=>x.action==='settings_save');
  assert.equal(audit.actor_id,i.config);assert.equal(audit.reason,'Identidade confirmada');assert.equal(audit.after.nif,'123456789');
 });
 await t.test('NFC counters atomically reject replay and request retries preserve result',async()=>{
  await root(db);const loc=(await db.query('SELECT id FROM p2g_clock_locations LIMIT 1')).rows[0].id;
  await clockSession(db,i.config,'service_role');const tag=(await db.query('SELECT p2g_clock_tag_manage($1,$2,$3) AS r',[i.org,i.config,{op:'create',location_id:loc,name:'Tag',kind:'static',token_hash:'a'.repeat(64),reason:'Tag autorizada'}])).rows[0].r;
  assert.equal(Object.hasOwn(tag,'token_hash'),false);
  const request=uuid();const punch=await clockPunch(db,'stop',{request_id:request,tag:{id:tag.id,counter:1}},{source:'nfc',location_id:loc});
  assert.equal(punch.duplicate,false);assert.equal((await clockPunch(db,'stop',{request_id:request,tag:{id:tag.id,counter:1}},{source:'nfc',location_id:loc})).duplicate,true);
  await assert.rejects(clockPunch(db,'start',{tag:{id:tag.id,counter:1}},{source:'nfc',location_id:loc}),/invalid_nfc/);
 });
 await t.test('inactive historical employees appear in manager reporting only',async()=>{
  await seedEntry(db,i.inactive,'start',ago(200));await clockSession(db,i.manager);
  const snap=await clockRpc(db,'snapshot',{});assert.ok(snap.people.some(x=>x.id===i.inactive&&!x.is_active));
  await clockSession(db);assert.ok(!(await clockRpc(db,'snapshot',{})).people.some(x=>x.id===i.inactive));
 });
 await t.test('refused attempts are immutable, deduplicated, scoped and never store NFC proof secrets',async()=>{
  const input={request_id:uuid(),action:'start',device_id:'test-device',tag:{id:uuid(),counter:2,token:'secret',cmac:'secret'},token:'secret'};
  await clockSession(db,i.employee,'service_role');
  for(let count=0;count<2;count++) await db.query('SELECT p2g_clock_attempt($1,$2,$3,$4)',[i.org,i.employee,input,'invalid_nfc']);
  await assert.rejects(db.query('SELECT p2g_clock_attempt($1,$2,$3,$4)',[i.otherOrg,i.employee,input,'invalid_nfc']),/membership_required/);
  await root(db);const attempts=(await db.query('SELECT * FROM p2g_clock_attempts')).rows;assert.equal(attempts.length,1);assert.equal(JSON.stringify(attempts).includes('secret'),false);
  await assert.rejects(db.query('DELETE FROM p2g_clock_attempts'),/immutable_attendance_record/);
  await clockSession(db);await assert.rejects(db.query('SELECT * FROM p2g_clock_attempts'),/permission denied/);
 });
 await t.test('existing mandatory MFA helper enforced rather than mocked',async()=>{
  await root(db);await db.query("INSERT INTO organization_security_settings VALUES ('96a3950e-31be-4c6d-abed-b82968c0d7e9',true)");
  await db.query("INSERT INTO user_roles VALUES ($1,'super_admin')",[i.employee]);
  await clockSession(db);await assert.rejects(clockRpc(db,'snapshot',{}),/access_denied/);
  await clockSession(db,i.employee,'authenticated','aal2');await assert.rejects(clockRpc(db,'snapshot',{}),/access_denied/);
  await root(db);await db.query("INSERT INTO auth.mfa_factors VALUES ($1,'totp','verified')",[i.employee]);
  await clockSession(db,i.employee,'authenticated','aal2');assert.equal((await clockRpc(db,'snapshot',{})).timezone,'Europe/Lisbon');
 });
});
async function clockPunchAfterSession(db,action) {await clockSession(db,i.employee,'service_role');return clockPunch(db,action);}