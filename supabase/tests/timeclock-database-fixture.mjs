import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

export const clockIds = Object.fromEntries(['org','otherOrg','employee','manager','config','stranger','inactive','profileManage','profileConfig','profilePlain'].map((key,index)=>[key,`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`]));
const migration = name => new URL(`../migrations/${name}`,import.meta.url);
export async function createClockDatabase(path, {seed=true}={}) {
 const db=new PGlite(path);
 if ((await db.query("SELECT to_regclass('public.p2g_clock_entries') AS table_name" )).rows[0].table_name) return db;
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE auth.mfa_factors(user_id uuid,factor_type text,status text);
 CREATE TABLE public.organizations(id uuid PRIMARY KEY,name text);
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text,avatar_url text);
 CREATE TABLE public.organization_profiles(id uuid PRIMARY KEY,organization_id uuid,base_role text,module_permissions jsonb);
 CREATE TABLE public.organization_members(user_id uuid,organization_id uuid,is_active boolean,profile_id uuid,PRIMARY KEY(user_id,organization_id));
 CREATE TABLE public.user_roles(user_id uuid,role text);
 CREATE TABLE public.organization_security_settings(organization_id uuid,require_mfa boolean);
 CREATE TABLE public.rh_holidays(organization_id uuid,date date,name text);
 CREATE TABLE public.rh_absences(id uuid PRIMARY KEY,organization_id uuid,user_id uuid,status text,start_date date,end_date date);
 CREATE TABLE public.rh_absence_periods(absence_id uuid,status text,start_date date,end_date date);
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;`);
 const mfa=await readFile(migration('20260929120000_require_p2g_mfa.sql'),'utf8');
 await db.exec(mfa.slice(mfa.indexOf('CREATE FUNCTION public.p2g_mfa_required()'),mfa.indexOf('CREATE FUNCTION public.enforce_p2g_mfa()')));
 await db.exec(await readFile(migration('20261019140509_p2g_time_clock.sql'),'utf8'));
 if (!seed) return db;
 const i=clockIds;
 await db.query('INSERT INTO organizations VALUES ($1,$2),($3,$4)',[i.org,'Local P2G',i.otherOrg,'Other']);
 for(const key of ['employee','manager','config','stranger','inactive']) {
  await db.query('INSERT INTO auth.users VALUES ($1)',[i[key]]);
  await db.query('INSERT INTO profiles VALUES ($1,$2,null)',[i[key],key]);
 }
 for(const [key,permissions] of [['profileManage',{rh:{subareas:{timeclock:{manage:true}}}}],['profileConfig',{rh:{subareas:{timeclock:{configure:true}}}}],['profilePlain',{rh:{subareas:{employees:{manage:true}}},portal_total_link:{subareas:{rh:{edit:true}}}}]]) {
  await db.query('INSERT INTO organization_profiles VALUES ($1,$2,$3,$4)',[i[key],i.org,'collaborator',permissions]);
 }
 for(const [user,profile,active] of [['employee','profilePlain',true],['manager','profileManage',true],['config','profileConfig',true],['inactive','profilePlain',false]]) await db.query('INSERT INTO organization_members VALUES ($1,$2,$3,$4)',[i[user],i.org,active,i[profile]]);
 await db.query('INSERT INTO organization_members VALUES ($1,$2,true,null)',[i.stranger,i.otherOrg]);
 return db;
}
export async function clockSession(db,user=clockIds.employee,role='authenticated',aal='aal1') {
 await db.exec('RESET ROLE');
 await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,role,aal})]);
 await db.exec(`SET ROLE ${role}`);
}
export async function clockRpc(db,action,payload) {
 return (await db.query('SELECT public.p2g_clock($1,$2) AS result',[action,{org:clockIds.org,...payload}])).rows[0].result;
}
export async function clockPunch(db,action,input={},decision={}) {
 return (await db.query('SELECT public.p2g_clock_register($1,$2,$3,$4) AS result',[
  clockIds.org,clockIds.employee,{request_id:crypto.randomUUID(),device_id:'local-device',action,...input},
  {status:'pending',flags:['no_gps'],source:'gps',metadata:{},...decision}
 ])).rows[0].result;
}
