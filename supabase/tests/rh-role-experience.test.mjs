import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const fixtureUrl = new URL('./rh-workspace.test.mjs',import.meta.url);
const original = await readFile(fixtureUrl,'utf8');
const fixtureSource = original.slice(0,original.indexOf('test("')).replace('from "@electric-sql/pglite"',`from ${JSON.stringify(import.meta.resolve('@electric-sql/pglite'))}`).replaceAll('import.meta.url',JSON.stringify(fixtureUrl.href)) + '\nexport {setup,as,mutate,request,org,user,manager,id};';
const {setup,as,mutate,request,org,user,manager,id} = await import(`data:text/javascript;base64,${Buffer.from(fixtureSource).toString('base64')}`);
const migration = [await readFile(new URL('../migrations/20261008160000_rh_role_experience.sql',import.meta.url),'utf8'), await readFile(new URL('../migrations/20261008170000_rh_support_free_subject.sql',import.meta.url),'utf8')].join(String.fromCharCode(10));
async function dbWithRoles(){const db=await setup();await db.exec(migration);return db;}
test('collaborator creates own request but cannot edit, cancel, approve, batch or create for a colleague',async()=>{
 const db=await dbWithRoles();try{
  const own=await as(db,user,()=>mutate(db,'create',request()));
  for(const action of ['edit','cancel','approve','withdraw','batch']) await assert.rejects(as(db,user,()=>mutate(db,action,{...request(),id:own.id,users:[user]})),/administrador/);
  await assert.rejects(as(db,user,()=>mutate(db,'create',request('2099-01-06',{user_id:manager}))),/administrador/);
  await assert.rejects(as(db,user,()=>db.query('select rh_absence_mutate_internal($1,$2,$3)',[org,'cancel',JSON.stringify({id:own.id})])),/permission denied/);
  await as(db,manager,()=>mutate(db,'edit',{...request('2099-01-06'),id:own.id}));
  await as(db,manager,()=>mutate(db,'approve',{id:own.id}));
 }finally{await db.close();}
});
test('ordinary profile permissions cannot expose colleague calendars, balances or tickets; admin sees all',async()=>{
 const db=await dbWithRoles();try{
  await as(db,user,()=>mutate(db,'create',request()));
  await as(db,manager,()=>mutate(db,'create',request('2099-01-06')));
  await db.query("insert into user_roles(user_id,role) values($1,'admin')",[user]);
  await db.query("update organization_profiles set module_permissions=$1 where id=$2",[JSON.stringify({rh:{subareas:{calendar:{view:true,manage:true},absences:{view:true,manage:true},balances:{view:true,manage:true},support:{view:true,manage:true}}}}),id(10)]);
  await db.query("insert into rh_records(organization_id,user_id,kind,data) values($1,$2,'ticket',$3)",[org,manager,JSON.stringify({title:'Private ticket',status:'open'})]);
  const own=await as(db,user,()=>db.query('select rh_snapshot($1) data',[org]));
  assert.equal(own.rows[0].data.permissions['administration.manage'],false);
  for(const key of ['calendar','absences','balances','members']) assert.ok(own.rows[0].data[key].every(r=>r.user_id===user),key);
  assert.equal(own.rows[0].data.records.filter(r=>r.kind==='ticket').length,0);
  const all=await as(db,manager,()=>db.query('select rh_snapshot($1) data',[org]));
  assert.equal(all.rows[0].data.permissions['administration.manage'],true);
  assert.equal(all.rows[0].data.calendar.length,2);
  assert.equal(all.rows[0].data.records.filter(r=>r.kind==='ticket').length,1);
 }finally{await db.close();}
});
test('ticket author and admin can reply, other collaborator cannot read or reply',async()=>{
 const db=await dbWithRoles();try{
  const ticket=await as(db,user,()=>db.query("select rh_record_save($1,'ticket',$2) result",[org,JSON.stringify({title:'Help',description:'Question',priority:'normal',status:'open'})]));
  const tid=ticket.rows[0].result.id;
  for(const actor of [user,manager]) await as(db,actor,()=>db.query("select rh_record_save(_org=>$1,_kind=>'message',_data=>$2,_parent=>$3)",[org,JSON.stringify({body:'Reply'}),tid]));
  await db.query('update organization_members set is_active=true where user_id=$1',[id(3)]);
  const snapshot=await as(db,id(3),()=>db.query('select rh_snapshot($1) data',[org]));
  assert.equal(snapshot.rows[0].data.records.filter(r=>['ticket','message'].includes(r.kind)).length,0);
  await assert.rejects(as(db,id(3),()=>db.query("select rh_record_save(_org=>$1,_kind=>'message',_data=>$2,_parent=>$3)",[org,JSON.stringify({body:'Forbidden'}),tid])));
 }finally{await db.close();}
});
test('notices require explicit recipients and cannot broaden audience by clearing recipients',async()=>{
 const db=await dbWithRoles();try{
  for(const recipients of [undefined,[]]) await assert.rejects(as(db,manager,()=>db.query("select rh_record_save($1,'notice',$2)",[org,JSON.stringify({title:'Notice',body:'Test',recipients,active:true})])),/destinatários/);
  const row=await as(db,manager,()=>db.query("select rh_record_save($1,'notice',$2) result",[org,JSON.stringify({title:'Notice',body:'Test',recipients:[user],active:true})]));
  await assert.rejects(as(db,manager,()=>db.query("select rh_record_save($1,'notice',$2,$3)",[org,JSON.stringify({...row.rows[0].result.data,recipients:[]}),row.rows[0].result.id])),/destinatários/);
  await as(db,manager,()=>db.query("select rh_record_save($1,'notice',$2,$3)",[org,JSON.stringify({...row.rows[0].result.data,active:false}),row.rows[0].result.id]));
  await assert.rejects(as(db,user,()=>db.query("select rh_record_save_internal($1,'notice',$2)",[org,JSON.stringify({title:'No',body:'No',recipients:[]})])),/permission denied/);
 }finally{await db.close();}
});
