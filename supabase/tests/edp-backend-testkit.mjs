import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export const IDS = {
  org: '10000000-0000-4000-8000-000000000001',
  otherOrg: '10000000-0000-4000-8000-000000000002',
  seller: '20000000-0000-4000-8000-000000000001',
  otherSeller: '20000000-0000-4000-8000-000000000002',
  admin: '20000000-0000-4000-8000-000000000003',
  outsider: '20000000-0000-4000-8000-000000000004',
  bo: '20000000-0000-4000-8000-000000000005',
  boProfile: '21000000-0000-4000-8000-000000000005',
  viewer: '20000000-0000-4000-8000-000000000006',
  viewerProfile: '21000000-0000-4000-8000-000000000006',
  client: '30000000-0000-4000-8000-000000000001',
  otherClient: '30000000-0000-4000-8000-000000000002',
  sale: '40000000-0000-4000-8000-000000000001',
  document: '50000000-0000-4000-8000-000000000001',
  documentVersion: '60000000-0000-4000-8000-000000000001',
  idempotency: '70000000-0000-4000-8000-000000000001',
};

const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create type public.app_role as enum ('super_admin','admin','viewer','salesperson');
create table auth.users(id uuid primary key);
create table public.organizations(id uuid primary key,name text not null);
create table public.user_roles(user_id uuid,role public.app_role,primary key(user_id,role));
create table public.profiles(id uuid primary key,organization_id uuid,full_name text not null,email text,phone text);
create table public.organization_members(user_id uuid,organization_id uuid,profile_id uuid,is_active boolean default true,role public.app_role,primary key(user_id,organization_id));
create table public.organization_profiles(id uuid primary key,organization_id uuid,name text,base_role public.app_role,module_permissions jsonb default '{}',data_scope text);
create table public.crm_clients(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 lead_id uuid,name text not null,email text,phone text,company text,nif text,company_nif text,decision_maker_name text,
 decision_makers jsonb not null default '[]',status text default 'active',source text,notes text,assigned_to uuid,
 created_by uuid,address_line1 text,address_line2 text,city text,postal_code text,country text,distrito text,
 conselho text,grupo_economico text,billing_target text not null default 'client',crc_code text check(crc_code is null or crc_code~'^[0-9]{4}-[0-9]{4}-[0-9]{4}$'),certificate_data jsonb,certificate_checked_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.proposals(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,lead_id uuid,created_by uuid,negotiation_type text,proposal_type text,edp_proposal_number text);
create table public.sales(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 client_id uuid references public.crm_clients,proposal_id uuid references public.proposals,lead_id uuid,created_by uuid,
 proposal_type text,negotiation_type text,edp_proposal_number text,service_type text,activation_date date,status text default 'in_progress'
);
create table public.cpes(id uuid primary key default gen_random_uuid(),organization_id uuid,client_id uuid,equipment_type text,serial_number text,service_type text,fidelizacao_start date);
create table public.proposal_cpes(id uuid primary key default gen_random_uuid(),proposal_id uuid,serial_number text,service_type text,contrato_inicio date);
create table public.email_sends(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,template_id uuid,client_id uuid,
 recipient_email text not null,recipient_name text,subject text not null,status text not null default 'queued',error_message text,
 sent_at timestamptz,opened_at timestamptz,sent_by uuid,created_at timestamptz not null default now(),brevo_message_id text
);
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb default '{}');
alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
grant all on all tables in schema public,storage to service_role;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.get_user_org_id(uid uuid) returns uuid language sql stable as $$select organization_id from public.organization_members where user_id=uid and is_active limit 1$$;
create function public.has_role(uid uuid,wanted public.app_role) returns boolean language sql stable as $$select exists(select 1 from public.user_roles where user_id=uid and role=wanted)$$;
create function public.is_org_admin(uid uuid,org uuid) returns boolean language sql stable as $$select public.has_role(uid,'admin') or public.has_role(uid,'super_admin')$$;
create function public.has_module_permission(_org uuid,_module text,_subarea text,_action text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare profile uuid; permissions jsonb; base text; configured text;
begin
  if public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'super_admin') then return true; end if;
  select profile_id into profile from public.organization_members where user_id=auth.uid() and organization_id=_org limit 1;
  if not found then return false; end if;
  if profile is null then return true; end if;
  select module_permissions,base_role into permissions,base from public.organization_profiles where id=profile;
  if base='admin' or permissions is null then return true; end if;
  configured:=permissions #>> array[_module,'subareas',_subarea,_action];
  if configured is not null then return configured='true'; end if;
  if permissions #>> array[_module,'view'] is not null then
    if _action='view' then return permissions #>> array[_module,'view']='true'; end if;
    if _action='delete' then return coalesce(permissions #>> array[_module,'delete']='true',false); end if;
    return coalesce(permissions #>> array[_module,'edit']='true',false);
  end if;
  return false;
end;
$$;
create function public.app_can_view_client(cid uuid) returns boolean language sql stable as $$select exists(
  select 1 from public.crm_clients c where c.id=cid and c.organization_id=public.get_user_org_id(auth.uid()) and (
    c.assigned_to=auth.uid() or public.is_org_admin(auth.uid(),c.organization_id) or exists(
      select 1 from public.organization_members om join public.organization_profiles op on op.id=om.profile_id
      where om.user_id=auth.uid() and om.organization_id=c.organization_id and op.data_scope='all'
    )
  )
)$$;
create function public.app_can_view_sale(sid uuid) returns boolean language sql stable as $$select exists(select 1 from public.sales s where s.id=sid and s.organization_id=public.get_user_org_id(auth.uid()) and (s.created_by=auth.uid() or public.is_org_admin(auth.uid(),s.organization_id) or public.app_can_view_client(s.client_id)))$$;
`;

export async function createEdpDatabase(options = {}) {
  const db = new PGlite();
  await db.exec(bootstrap);
  if (options.beforeMigration) await options.beforeMigration(db);
  await db.exec(fs.readFileSync('supabase/migrations/20261028120000_edp_local_workflow.sql', 'utf8'));
  const i = IDS;
  await db.exec(`
    insert into public.organizations values('${i.org}','Org local'),('${i.otherOrg}','Outra org') on conflict do nothing;
    insert into auth.users values('${i.seller}'),('${i.otherSeller}'),('${i.admin}'),('${i.outsider}'),('${i.bo}'),('${i.viewer}') on conflict do nothing;
    insert into public.organization_profiles(id,organization_id,name,base_role,module_permissions,data_scope)
      values('${i.boProfile}','${i.org}','Back Office','viewer','{}','all'),
        ('${i.viewerProfile}','${i.org}','Visualizador','viewer','{"sales":{"subareas":{"sales":{"view":true,"edit":false}}}}','all')
      on conflict do nothing;
    insert into public.organization_members(user_id,organization_id,role,is_active) values
      ('${i.seller}','${i.org}','salesperson',true),('${i.otherSeller}','${i.org}','salesperson',true),
      ('${i.admin}','${i.org}','admin',true),('${i.outsider}','${i.otherOrg}','salesperson',true)
      on conflict do nothing;
    insert into public.organization_members(user_id,organization_id,profile_id,is_active)
      values('${i.bo}','${i.org}','${i.boProfile}',true),('${i.viewer}','${i.org}','${i.viewerProfile}',true) on conflict do nothing;
    insert into public.user_roles values('${i.admin}','admin') on conflict do nothing;
    insert into public.crm_clients(id,organization_id,name,nif,assigned_to,created_by) values
      ('${i.client}','${i.org}','Cliente A','501234567','${i.seller}','${i.seller}'),
      ('${i.otherClient}','${i.otherOrg}','Cliente B','509876543','${i.outsider}','${i.outsider}');
    insert into public.sales(id,organization_id,client_id,created_by,proposal_type,negotiation_type,edp_proposal_number)
      values('${i.sale}','${i.org}','${i.client}','${i.seller}','Energia','Nova Ligação','SF-1');
  `);
  return db;
}

export async function asUser(db, userId, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);");
  }
}
