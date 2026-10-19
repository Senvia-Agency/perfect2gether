import test from 'node:test';
import assert from 'node:assert/strict';
import {createClockDatabase,clockIds as i,clockSession,clockRpc} from './timeclock-database-fixture.mjs';

test('public identity helpers cannot enumerate another member or permissions',async t=>{
 const db=await createClockDatabase();t.after(()=>db.close());await clockSession(db);
 assert.equal((await db.query('SELECT p2g_clock_member($1,$2) AS v',[i.org,i.employee])).rows[0].v,true);
 assert.equal((await db.query('SELECT p2g_clock_member($1,$2) AS v',[i.org,i.manager])).rows[0].v,false);
 assert.equal((await db.query("SELECT p2g_clock_can($1,'manage',$2) AS v",[i.org,i.manager])).rows[0].v,false);
 await assert.rejects(db.query('SELECT p2g_clock_private.member($1,$2)',[i.org,i.manager]),/permission denied/);
 await clockSession(db,i.manager);assert.equal((await clockRpc(db,'snapshot',{})).can_manage,true);
});
test('status decisions preserve correction provenance; edits and creates mark correction',async t=>{
 const db=await createClockDatabase();t.after(()=>db.close());
 const id=(await db.query("INSERT INTO p2g_clock_entries(organization_id,user_id,action,entry_type,kind,punched_at,status,source) VALUES($1,$2,'start','in','work',now()-interval '1 hour','pending','gps') RETURNING id",[i.org,i.employee])).rows[0].id;
 await clockSession(db,i.manager);
 for(const op of ['approve','void','restore','reject','restore']) {
  const entry=await clockRpc(db,'entry_manage',{op,id,reason:'Validação administrativa'});assert.equal(entry.corrected,false,op);
 }
 const edited=await clockRpc(db,'entry_manage',{op:'edit',id,note:'Hora confirmada',reason:'Correção administrativa'});assert.equal(edited.corrected,true);
 assert.equal((await clockRpc(db,'entry_manage',{op:'approve',id,reason:'Validação administrativa'})).corrected,true);
});

test('secure NTAG counter is shared across users, consumed atomically, and retry is stable',async t=>{
 const db=await createClockDatabase();t.after(()=>db.close());
 const location=(await db.query("INSERT INTO p2g_clock_locations(organization_id,name,latitude,longitude) VALUES($1,'Sede',38,-9) RETURNING id",[i.org])).rows[0].id;
 const tag=(await db.query("INSERT INTO p2g_clock_tags(organization_id,location_id,name,kind,aes_key,uid_hex) VALUES($1,$2,'Secure','ntag424',$3,$4) RETURNING id",[i.org,location,'a'.repeat(32),'b'.repeat(14)])).rows[0].id;
 await clockSession(db,i.employee,'service_role');
 const input={request_id:crypto.randomUUID(),device_id:'secure-device',action:'start',tag:{id:tag,counter:42}};
 const decision={status:'valid',source:'nfc',flags:[],location_id:location};
 const call=(user,payload)=>db.query('SELECT p2g_clock_register($1,$2,$3,$4) AS r',[i.org,user,payload,decision]);
 const outcomes=await Promise.allSettled([call(i.employee,input),call(i.manager,{...input,request_id:crypto.randomUUID()})]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 const refused=outcomes.find(x=>x.status==='rejected');assert.match(refused.reason.message,/invalid_nfc/);
 assert.equal((await call(i.employee,input)).rows[0].r.duplicate,true);
 await db.exec('RESET ROLE');
 assert.equal((await db.query('SELECT last_counter FROM p2g_clock_tags WHERE id=$1',[tag])).rows[0].last_counter,42);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM p2g_clock_entries')).rows[0].n,1);
});
