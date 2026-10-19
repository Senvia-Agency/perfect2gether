process.on('uncaughtException', e => { console.error(e.message, e.where ?? '', e.position ?? ''); process.exit(1); });
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec(`CREATE PUBLICATION supabase_realtime; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('aal',coalesce(current_setting('request.jwt.claim.aal',true),'aal1')) $$;
CREATE TABLE public.organizations(id uuid PRIMARY KEY);
CREATE TABLE public.organization_profiles(id uuid PRIMARY KEY,organization_id uuid,base_role text);
CREATE TABLE public.organization_members(user_id uuid,organization_id uuid,is_active boolean,profile_id uuid);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text,avatar_url text);
CREATE TABLE public.user_roles(user_id uuid,role text);
CREATE FUNCTION public.p2g_mfa_required() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.mfa',true),''),'false')::boolean $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,UNIQUE(bucket_id,name)); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auth,storage TO authenticated; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
CREATE POLICY broad_existing_storage_policy ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);`);
await db.exec(await readFile(new URL('../migrations/20261019130000_internal_messages.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../migrations/20261019140000_p2g_chat_jobs.sql',import.meta.url),'utf8'));
{ const tables=(await db.query("SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename")).rows.map(x=>x.tablename); assert.deepEqual(tables,['p2g_chat_conversations','p2g_chat_messages']); }
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [org,org2,a,b,admin,c,inactive]=[1,2,3,4,5,6,7].map(id);
await db.query('INSERT INTO public.organizations VALUES($1),($2)',[org,org2]);
for(const [u,o,active] of [[a,org,true],[b,org,true],[admin,org,true],[c,org2,true],[inactive,org,false]]) { await db.query('INSERT INTO public.organization_members VALUES($1,$2,$3,NULL)',[u,o,active]); await db.query('INSERT INTO public.profiles VALUES($1,$2,NULL)',[u,`User ${u}`]); }
await db.query("INSERT INTO public.user_roles VALUES($1,'super_admin')",[admin]);
async function as(u){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u]); await db.exec('SET ROLE authenticated');}
async function rpc(action,payload){return (await db.query('SELECT public.p2g_chat($1,$2::jsonb) AS result',[action,JSON.stringify(payload)])).rows[0].result;}
let checks=1;async function denied(fn){await assert.rejects(fn);checks++;}function eq(a,b){assert.deepEqual(a,b);checks++;}
await as(a);
const conv=await rpc('create',{org,kind:'group',title:'Team',participants:[b]});
await denied(()=>rpc('create',{org,kind:'group',title:'bad',participants:[c]}));
await denied(()=>rpc('create',{org,kind:'group',title:'bad',participants:[inactive]}));
await denied(()=>rpc('create',{org,kind:'announcement',title:'news',participants:[b]}));
const mid=id(10); const sent=await rpc('send',{id:mid,conversation:conv,body:'Olá café',reply_to:null,attachments:[]});eq(sent.body,'Olá café');eq((await rpc('send',{id:mid,conversation:conv,body:'retry',attachments:[]})).body,'Olá café');
eq((await rpc('history',{conversation:conv})).length,1);
eq((await rpc('search',{org,query:'cafe'})).length,1);
await rpc('preferences',{conversation:conv,pinned:true,muted:true,archived:true});
await rpc('save',{message:mid,saved:true});eq((await rpc('history',{conversation:conv}))[0].saved,true);
await rpc('pin_message',{message:mid,pinned:true});
await denied(()=>db.query('UPDATE public.p2g_chat_messages SET body=$1 WHERE id=$2',['hack',mid]));
await denied(()=>db.query('INSERT INTO public.p2g_chat_members(conversation_id,user_id,role) VALUES($1,$2,$3)',[conv,c,'owner']));
await as(b);eq((await rpc('history',{conversation:conv}))[0].saved,false);eq((await db.query('SELECT * FROM public.p2g_chat_preferences')).rows.length,0);
await denied(()=>rpc('edit',{message:mid,body:'steal'}));await denied(()=>rpc('delete',{message:mid}));await denied(()=>rpc('manage',{conversation:conv,op:'rename',title:'steal'}));await denied(()=>rpc('pin_message',{message:mid,pinned:false}));
await as(admin);eq((await db.query('SELECT * FROM public.p2g_chat_messages')).rows.length,0);await denied(()=>rpc('history',{conversation:conv}));eq((await rpc('search',{org,query:'cafe'})).length,0);
const announcement=await rpc('create',{org,kind:'announcement',title:'news',participants:[b]});
await as(b);await denied(()=>rpc('send',{id:id(11),conversation:announcement,body:'bad',attachments:[]}));
await as(c);await denied(()=>rpc('snapshot',{org}));await denied(()=>rpc('history',{conversation:conv}));
await as(inactive);await denied(()=>rpc('snapshot',{org}));
await as(a);await denied(()=>rpc('manage',{conversation:conv,op:'leave'}));
const fileid=id(12),filemsg=id(13),path=`${org}/${conv}/${a}/${filemsg}/${fileid}`;
await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES($1,$2,$3,$4)',['p2g-chat-files',path,a,JSON.stringify({size:5,mimetype:'text/plain'})]);
await denied(()=>rpc('send',{id:filemsg,conversation:conv,body:'',attachments:[{id:fileid,path,name:'x.txt',mime:'text/plain',size:99}]}));
await rpc('send',{id:filemsg,conversation:conv,body:'',attachments:[{id:fileid,path,name:'x.txt',mime:'text/plain',size:5}]});
await as(b);eq((await db.query('SELECT * FROM storage.objects')).rows.length,1);
await as(admin);eq((await db.query('SELECT * FROM storage.objects')).rows.length,0);
await as(a);await rpc('delete',{message:filemsg});eq((await db.query('SELECT * FROM storage.objects')).rows.length,0);await denied(()=>rpc('edit',{message:filemsg,body:'restore'}));
await db.exec('RESET ROLE');eq((await db.query('SELECT count(*)::int n FROM public.p2g_chat_file_cleanup')).rows[0].n,1);eq((await db.query('SELECT count(*)::int n FROM public.p2g_chat_push_jobs')).rows[0].n,2);
await as(a);await rpc('manage',{conversation:conv,op:'remove',user:b});await as(b);await denied(()=>rpc('history',{conversation:conv}));eq((await db.query('SELECT * FROM public.p2g_chat_messages')).rows.length,0);
await as(a);await rpc('manage',{conversation:conv,op:'add',user:b});await as(b);eq((await rpc('history',{conversation:conv})).length,0);eq((await rpc('search',{org,query:'cafe'})).length,0);
await as(a);await db.query("SELECT set_config('test.mfa','true',false)");await denied(()=>rpc('snapshot',{org}));eq((await db.query('SELECT * FROM public.p2g_chat_messages')).rows.length,0);await db.query("SELECT set_config('request.jwt.claim.aal','aal2',false)");eq((await rpc('snapshot',{org})).conversations.length,1);
await db.query("SELECT set_config('test.mfa','false',false)");
await as(a);
const direct=await rpc('create',{org,kind:'direct',title:'',participants:[b]});
await as(b);eq(await rpc('create',{org,kind:'direct',title:'',participants:[a]}),direct);
await as(a);await denied(()=>rpc('create',{org,kind:'direct',title:'',participants:[b,admin]}));
await denied(()=>rpc('send',{id:id(50),conversation:direct,body:'x',reply_to:mid,attachments:[]}));
await denied(()=>rpc('send',{id:id(50),conversation:direct,body:'x'.repeat(4001),attachments:[]}));
await denied(()=>rpc('send',{id:id(50),conversation:direct,body:'',attachments:[]}));
eq((await db.query('UPDATE storage.objects SET name=$1 WHERE name=$2 RETURNING name',[path+'bad',path])).rows.length,0);
await denied(()=>db.query('INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES($1,$2,$3,$4)',['p2g-chat-files',org+'/'+conv+'/'+b+'/'+id(60)+'/'+id(61),a,'{}']));
await denied(()=>db.query('SELECT * FROM public.p2g_chat_push_jobs'));await denied(()=>db.query('SELECT * FROM public.p2g_chat_file_cleanup'));
await rpc('save',{message:mid,saved:true});eq((await rpc('saved',{org})).length,1);
await as(b);eq((await rpc('saved',{org})).length,0);await denied(()=>rpc('history',{conversation:conv,around:mid}));await denied(()=>rpc('save',{message:mid,saved:true}));
await as(a);for(let n=100;n<165;n++) await rpc('send',{id:id(n),conversation:conv,body:'page '+n,attachments:[]});
const page=await rpc('history',{conversation:conv});eq(page.length,60);eq(page.at(-1).id,id(164));
const around=await rpc('history',{conversation:conv,around:id(101)});eq(around.at(-1).id,id(101));assert.ok(around.length<=60);checks++;
eq((await rpc('snapshot',{org})).conversations.find(x=>x.id===conv).archived,true);
await as(b);const snap=await rpc('snapshot',{org});eq(snap.conversations.find(x=>x.id===conv).unread,65);await rpc('read',{conversation:conv});eq((await rpc('snapshot',{org})).conversations.find(x=>x.id===conv).unread,0);
await rpc('preferences',{conversation:conv,muted:true});await as(a);await rpc('send',{id:id(200),conversation:conv,body:'muted',attachments:[]});
await db.exec('RESET ROLE');eq((await db.query('SELECT count(*)::int n FROM public.p2g_chat_push_jobs WHERE message_id=$1',[id(200)])).rows[0].n,0);
eq((await db.query('SELECT public,file_size_limit FROM storage.buckets')).rows[0],{public:false,file_size_limit:null});
await as(a);await rpc('manage',{conversation:conv,op:'promote',user:b});await rpc('manage',{conversation:conv,op:'leave'});await denied(()=>rpc('history',{conversation:conv}));await as(b);await denied(()=>rpc('manage',{conversation:conv,op:'leave'}));
await db.exec('RESET ROLE');
await db.exec('SET ROLE anon');await denied(()=>rpc('snapshot',{org}));await db.exec('RESET ROLE');
// Sequential state-boundary checks exercise stale client state. PGlite provides one
// connection, so this suite cannot reproduce a real two-session lock wait.
await as(a);const boundary=await rpc('create',{org,kind:'group',title:'Boundary',participants:[b]});
const stale=await rpc('send',{id:id(300),conversation:boundary,body:'original',attachments:[]});
await rpc('delete',{message:stale.id});await denied(()=>rpc('edit',{message:stale.id,body:'stale client restore'}));await denied(()=>rpc('delete',{message:stale.id}));
await rpc('manage',{conversation:boundary,op:'promote',user:b});
await as(b);await rpc('manage',{conversation:boundary,op:'remove',user:a});
await as(a);
for(const [action,payload] of [
 ['send',{id:id(301),conversation:boundary,body:'stale send',attachments:[]}],
 ['edit',{message:stale.id,body:'stale edit'}],['delete',{message:stale.id}],['react',{message:stale.id,emoji:'x'}],['save',{message:stale.id,saved:true}],['pin_message',{message:stale.id,pinned:true}],
 ['preferences',{conversation:boundary,archived:false}],['read',{conversation:boundary}],['typing',{conversation:boundary}],['presence',{conversation:boundary}],['manage',{conversation:boundary,op:'rename',title:'stale rename'}]
]) await denied(()=>rpc(action,payload));
await db.exec('RESET ROLE');const tombstone=(await db.query('SELECT body,deleted_at FROM public.p2g_chat_messages WHERE id=$1',[stale.id])).rows[0];eq(tombstone.body,'');assert.ok(tombstone.deleted_at);checks++;
eq((await db.query('SELECT count(*)::int n FROM public.p2g_chat_messages WHERE id=$1',[id(301)])).rows[0].n,0);
await as(a);await denied(()=>db.query('SELECT public.p2g_chat_take_work()'));
await db.exec('RESET ROLE');await db.exec('SET ROLE service_role');
const claimed=(await db.query('SELECT public.p2g_chat_take_work() AS result')).rows[0].result;eq(claimed.push.length,15);eq(claimed.cleanup.length,1);eq(claimed.push.every(x=>x.attempts===1),true);
const second=(await db.query('SELECT public.p2g_chat_take_work() AS result')).rows[0].result;eq(second.cleanup.length,0);eq(second.push.some(x=>claimed.push.some(y=>x.id===y.id)),false);
await db.exec('RESET ROLE');
console.log(`PASS ${checks} database authorization/contract assertions; real migration executed in PGlite PostgreSQL.`);
await db.close();
