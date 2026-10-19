import { PGlite } from '@electric-sql/pglite';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function openDatabase(directory = path.resolve('.messages.local')) {
  await mkdir(directory, { recursive: true });
  const db = new PGlite(directory);
  const installed = (await db.query("SELECT to_regclass('public.p2g_chat_messages') IS NOT NULL AS installed")).rows[0].installed;
  if (!installed) {
    await db.exec(`CREATE PUBLICATION supabase_realtime; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('aal',coalesce(current_setting('request.jwt.claim.aal',true),'aal1')) $$;
      CREATE TABLE public.organizations(id uuid PRIMARY KEY);
      CREATE TABLE public.organization_profiles(id uuid PRIMARY KEY,organization_id uuid,base_role text);
      CREATE TABLE public.organization_members(user_id uuid,organization_id uuid,is_active boolean,profile_id uuid,PRIMARY KEY(user_id,organization_id));
      CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text,avatar_url text);
      CREATE TABLE public.user_roles(user_id uuid,role text,PRIMARY KEY(user_id,role));
      CREATE FUNCTION public.p2g_mfa_required() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,UNIQUE(bucket_id,name));
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,storage TO authenticated;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
      CREATE POLICY baseline_storage_access ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);`);
    for (const migration of ['20261019130000_internal_messages.sql', '20261019140000_p2g_chat_jobs.sql']) {
      await db.exec(await readFile(path.resolve('supabase/migrations', migration), 'utf8'));
    }
  }
  return db;
}

export async function assumeUser(db, identity) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)", [identity.userId, identity.aal]);
  await db.exec('SET ROLE authenticated');
}
