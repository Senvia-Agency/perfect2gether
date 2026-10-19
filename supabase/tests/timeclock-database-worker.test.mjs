import test from 'node:test';
import assert from 'node:assert/strict';
import {createClockDatabase,clockIds as i,clockSession,clockRpc,clockPunch} from './timeclock-database-fixture.mjs';
const worker=async(db,action,input={})=>(await db.query('SELECT p2g_clock_worker($1,$2) AS r',[action,input])).rows[0].r;
async function root(db) {await db.exec('RESET ROLE');}
async function service(db) {await clockSession(db,i.employee,'service_role');}
async function resetJobs(db) {await root(db);await db.exec('TRUNCATE p2g_clock_jobs,p2g_clock_notifications');await service(db);}
async function schedule(db) {
 await clockSession(db,i.config);
 await clockRpc(db,'schedule_save',{user:i.employee,weekdays:[1,2,3,4,5,6,7],start_time:'00:00',lunch_time:'23:57',return_time:'23:58',end_time:'23:59',tolerance_minutes:0,enabled:true,reason:'Horário autorizado'});
 await service(db);
}

test('reminder eligibility, queue leases, notification ownership and review email policy',async t=>{
 const db=await createClockDatabase();t.after(()=>db.close());
 await schedule(db);
 await t.test('eligible reminders enqueue once per event and channel, never send directly',async()=>{
  await worker(db,'enqueue_reminders');await worker(db,'enqueue_reminders');
  const claimed=await worker(db,'claim');assert.equal(claimed.length,2);assert.deepEqual(claimed.map(x=>x.channel).sort(),['notification','push']);
  assert.ok(claimed.every(x=>x.attempts===1&&x.event_key.endsWith(':start')));
  assert.deepEqual(await worker(db,'claim'),[]);
  await assert.rejects(worker(db,'complete',{id:claimed[0].id,success:true}),/job_not_claimed/);
  await assert.rejects(worker(db,'complete',{id:claimed[0].id,claimed_at:'2000-01-01T00:00:00Z',success:true}),/job_not_claimed/);
  for(const job of claimed) await worker(db,'complete',{id:job.id,claimed_at:job.claimed_at,success:true});
  await clockSession(db);const notes=(await clockRpc(db,'snapshot',{})).notifications;assert.equal(notes.length,1);
  await clockRpc(db,'notification_read',{id:notes[0].id});assert.ok((await clockRpc(db,'snapshot',{})).notifications[0].read_at);
  await clockSession(db,i.manager);assert.equal((await clockRpc(db,'snapshot',{})).notifications.length,0);
 });
 await t.test('holidays, disabled schedules and inactive membership suppress reminders',async()=>{
  await resetJobs(db);await root(db);
  await db.query("INSERT INTO rh_holidays VALUES ($1,(now() AT TIME ZONE 'Europe/Lisbon')::date,'Feriado')",[i.org]);
  await service(db);await worker(db,'enqueue_reminders');assert.deepEqual(await worker(db,'claim'),[]);
  await root(db);await db.exec('TRUNCATE rh_holidays');await db.exec('UPDATE p2g_clock_schedules SET enabled=false');await service(db);
  await worker(db,'enqueue_reminders');assert.deepEqual(await worker(db,'claim'),[]);
  await root(db);await db.exec('UPDATE p2g_clock_schedules SET enabled=true');await db.query('UPDATE organization_members SET is_active=false WHERE user_id=$1',[i.employee]);await service(db);
  await worker(db,'enqueue_reminders');assert.deepEqual(await worker(db,'claim'),[]);
  await root(db);await db.query('UPDATE organization_members SET is_active=true WHERE user_id=$1',[i.employee]);
 });
 await t.test('approved absences and approved periods suppress reminders',async()=>{
  await root(db);const absence=crypto.randomUUID();
  await db.query("INSERT INTO rh_absences VALUES ($1,$2,$3,'approved',current_date,current_date)",[absence,i.org,i.employee]);
  await service(db);await worker(db,'enqueue_reminders');assert.deepEqual(await worker(db,'claim'),[]);
  await root(db);await db.query("UPDATE rh_absences SET status='partially_approved' WHERE id=$1",[absence]);
  await db.query("INSERT INTO rh_absence_periods VALUES ($1,'approved',current_date,current_date)",[absence]);
  await service(db);await worker(db,'enqueue_reminders');assert.deepEqual(await worker(db,'claim'),[]);
  await root(db);await db.exec('TRUNCATE rh_absence_periods,rh_absences');
 });
 await t.test('voided start does not satisfy reminder; effective start does',async()=>{
  await root(db);
  await db.query("INSERT INTO p2g_clock_entries(organization_id,user_id,action,entry_type,kind,punched_at,status,source) VALUES($1,$2,'start','in','work',now()-interval '1 hour','voided','admin')",[i.org,i.employee]);
  await service(db);await worker(db,'enqueue_reminders');assert.equal((await worker(db,'claim')).length,2);
  await resetJobs(db);await root(db);await db.exec("UPDATE p2g_clock_entries SET status='valid'");
  await service(db);await worker(db,'enqueue_reminders');assert.deepEqual(await worker(db,'claim'),[]);
 });
 await t.test('outside location alone has no review email; manual correction does',async()=>{
  await service(db);await clockPunch(db,'pause',{}, {flags:['outside_location'],status:'pending'});
  assert.deepEqual(await worker(db,'claim'),[]);
  await root(db);await db.exec("UPDATE p2g_clock_entries SET punched_at=now()-interval '2 seconds' WHERE action='pause'" );await service(db);
  const stamp=(await db.query('SELECT now()-interval \'1 second\' AS at')).rows[0].at;
  await clockPunch(db,'resume',{at:stamp.toISOString(),note:'Regresso esquecido'});
  const jobs=await worker(db,'claim');assert.equal(jobs.length,1);assert.equal(jobs[0].channel,'email');assert.equal(jobs[0].user_id,i.manager);assert.ok(jobs[0].payload.flags.includes('manual_time'));
 });
});

test('sequence timeout, strict chronological edits, permissions and reporting boundaries',async t=>{
 const db=await createClockDatabase();t.after(()=>db.close());
 await t.test('start closes stale stream after twelve hours and later pause is valid',async()=>{
  await db.query("INSERT INTO p2g_clock_entries(organization_id,user_id,action,entry_type,kind,punched_at,status,source,created_at) VALUES($1,$2,'start','in','work',now()-interval '12 hours','valid','gps',now()-interval '12 hours')",[i.org,i.employee]);
  await service(db);assert.equal((await clockPunch(db,'start')).duplicate,false);
  assert.equal((await clockPunch(db,'pause')).entry.action,'pause');
 });
 await t.test('service revalidates membership and rejects anonymous service impersonation',async()=>{
  await root(db);await db.query('UPDATE organization_members SET is_active=false WHERE user_id=$1',[i.employee]);await service(db);
  await assert.rejects(clockPunch(db,'resume'),/membership_required/);
  await root(db);await db.query('UPDATE organization_members SET is_active=true WHERE user_id=$1',[i.employee]);await clockSession(db);
  await assert.rejects(clockPunch(db,'resume'),/permission denied/);
 });
 await t.test('manager approved edits preserve all-sequence invariants and audit reasons',async()=>{
  await clockSession(db,i.manager);
  const snap=await clockRpc(db,'snapshot',{});const first=snap.entries[0];
  await assert.rejects(clockRpc(db,'entry_manage',{op:'edit',id:first.id,action:'stop',reason:'Correção'}),/invalid_state/);
  await assert.rejects(clockRpc(db,'entry_manage',{op:'approve',id:first.id,reason:'1!'}),/reason_required/);
  const result=await clockRpc(db,'entry_manage',{op:'edit',id:first.id,note:'Nota corrigida',reason:'Corrigir nota'});assert.equal(result.corrected,true);
  const after=await clockRpc(db,'snapshot',{});assert.equal(after.history.find(x=>x.entry_id===first.id).reason,'Corrigir nota');
 });
 await t.test('snapshot month is Lisbon local with exactly twelve hour boundary padding',async()=>{
  await clockSession(db);await assert.rejects(clockRpc(db,'snapshot',{month:'2026-13'}),/invalid_month/);
  await root(db);
  await db.query("INSERT INTO p2g_clock_entries(organization_id,user_id,action,entry_type,kind,punched_at,status,source) VALUES ($1,$2,'start','in','work','2026-02-28T11:59:59Z','voided','gps'),($1,$2,'start','in','work','2026-02-28T12:00:00Z','voided','gps'),($1,$2,'start','in','work','2026-04-01T10:59:59Z','voided','gps'),($1,$2,'start','in','work','2026-04-01T11:00:00Z','voided','gps')",[i.org,i.employee]);
  await clockSession(db);const snapshot=await clockRpc(db,'snapshot',{month:'2026-03'});
  assert.equal(snapshot.entries.length,2);assert.equal(snapshot.entries[0].punched_at,'2026-02-28T12:00:00+00:00');
 });
});