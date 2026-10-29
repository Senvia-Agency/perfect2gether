import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const organizationId = '96a3950e-31be-4c6d-abed-b82968c0d7e9';
const leadId = '00000000-0000-4000-8000-000000000101';
const existingClientId = '00000000-0000-4000-8000-000000000102';
const actorId = '00000000-0000-4000-8000-000000000199';

const migrationDirectory = 'supabase/migrations';
const transferMigration = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('_edp_client_transfer.sql'))
  .sort()
  .at(-1);

const baseSchema = `
  create role authenticated;
  create role anon;
  create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as $$
    select nullif(current_setting('test.uid', true), '')::uuid
  $$;
  create function public.p2g_mfa_ok() returns boolean language sql as $$
    select coalesce(current_setting('test.mfa', true), 'true') <> 'false'
  $$;
  create function public.get_user_org_id(uuid) returns uuid language sql as $$
    select coalesce(
      nullif(current_setting('test.organization_id', true), '')::uuid,
      '${organizationId}'::uuid
    )
  $$;
  create function public.p2g_can_read_lead(uuid, uuid) returns boolean language sql as $$
    select $1 = public.get_user_org_id(auth.uid())
      and coalesce(current_setting('test.can_read_lead', true), 'true') <> 'false'
  $$;
  create function public.app_can_view_client(uuid) returns boolean language sql as $$
    select coalesce(current_setting('test.can_view_client', true), 'true') <> 'false'
  $$;
  grant usage on schema auth to authenticated;

  create table public.organizations(id uuid primary key, niche text);
  create table public.leads(
    id uuid primary key,
    organization_id uuid not null,
    name text,
    email text,
    phone text,
    company_name text,
    company_nif text,
    notes text,
    assigned_to uuid,
    source text,
    custom_data jsonb,
    status text
  );
  create table public.crm_clients(
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    lead_id uuid,
    name text not null,
    email text,
    phone text,
    company text,
    company_nif text,
    nif text,
    notes text,
    assigned_to uuid,
    source text,
    status text,
    decision_maker_name text,
    decision_makers jsonb not null default '[]'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create table public.cpes(
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    client_id uuid not null,
    serial_number text,
    equipment_type text,
    comercializador text not null,
    status text,
    notes text
  );
  create table public.proposals(
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    lead_id uuid,
    client_id uuid
  );
  create table public.sales(like public.proposals including defaults);
  alter table public.sales add column proposal_id uuid;
  create table public.pipeline_stages(
    organization_id uuid not null,
    key text not null,
    is_final_positive boolean not null,
    name text not null
  );

  create table public.client_people(
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null,
    client_id uuid not null,
    name text not null check (btrim(name) <> '' and char_length(name) <= 200),
    nif text check (nif is null or nif ~ '^[0-9]{9}$'),
    phone text check (phone is null or char_length(phone) <= 40),
    email text check (email is null or char_length(email) <= 320),
    source text not null check (source in ('legacy','manual','mj','crc_lookup')),
    source_ref text,
    source_metadata jsonb not null default '{}'::jsonb,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create unique index client_people_client_nif_unique
    on public.client_people(client_id, nif) where nif is not null;
  create table public.client_person_roles(
    person_id uuid not null references public.client_people(id) on delete cascade,
    client_id uuid not null,
    organization_id uuid not null,
    role text not null,
    source text not null,
    created_at timestamptz not null default now(),
    primary key(person_id, role)
  );

  alter table public.leads enable row level security;
  alter table public.crm_clients enable row level security;
  alter table public.cpes enable row level security;
  alter table public.client_people enable row level security;
  alter table public.client_person_roles enable row level security;
  create policy visible_leads on public.leads for all to authenticated using(true) with check(true);
  create policy visible_clients on public.crm_clients for all to authenticated using(true) with check(true);
  create policy visible_cpes on public.cpes for all to authenticated using(true) with check(true);
  create policy visible_people on public.client_people for all to authenticated using(true) with check(true);
  create policy visible_person_roles on public.client_person_roles for all to authenticated using(true) with check(true);
  grant select, insert, update on all tables in schema public to authenticated;
  revoke insert, update, delete on public.client_people, public.client_person_roles from authenticated;

  create function public.can_manage_sales_for_organization(uuid) returns boolean language sql as $$
    select true
  $$;
  create function public.has_module_permission(uuid, text, text, text) returns boolean language sql as $$
    select coalesce(current_setting('test.has_module_permission', true), 'true') <> 'false'
  $$;

  insert into public.organizations values('${organizationId}', 'telecom');
  insert into auth.users values('${actorId}');
  insert into public.pipeline_stages values('${organizationId}', 'won', true, 'Ganho');
  select set_config('test.uid', '${actorId}', false);
  select set_config('test.organization_id', '${organizationId}', false);
`;

const certificateMigration = readFileSync(
  `${migrationDirectory}/20261023083420_client_certificates.sql`,
  'utf8',
);
const originalConversionMigration = readFileSync(
  `${migrationDirectory}/20261015080116_p2g_atomic_lead_conversion.sql`,
  'utf8',
);

async function createFixture({ customData, existingSourceMetadata } = {}) {
  assert.ok(transferMigration, 'an additive _edp_client_transfer.sql migration must implement the client transfer contract');
  const db = new PGlite();
  await db.exec(baseSchema);
  await db.exec(certificateMigration);
  await db.exec(originalConversionMigration);
  await db.exec(readFileSync(`${migrationDirectory}/${transferMigration}`, 'utf8'));

  const leadCustomData = customData ?? {
    prospect_id: '00000000-0000-4000-8000-000000000103',
    source_file_name: 'fixture-mj.json',
    decision_makers: [{
      name: 'Carla Decisora',
      role: 'Diretora Financeira',
      phone: '910000001',
      email: 'carla@example.test',
      nif: '333 333 333',
    }],
    metadata: {
      source_portal: 'publicacoes.mj.pt',
      publication_date: '2026-10-20',
      cae: { principal: '62010', secundarios: ['62020'] },
      gerentes: [{ nome: 'Ana Silva', nif: '111 111 111', telefone: '910000002' }],
      socios: [
        { nome: 'Ana Silva', nif: '111111111' },
        { nome: 'Ana Silva', nif: '222222222' },
      ],
    },
  };

  await db.query(
    `insert into public.leads(
      id, organization_id, name, email, phone, company_name, company_nif,
      notes, assigned_to, source, custom_data, status
    ) values($1, $2, 'Contacto', 'contact@example.test', '910000000',
      'Empresa Exemplo', ' 501234567 ', 'nota', $3, 'prospect', $4, 'new')`,
    [leadId, organizationId, actorId, leadCustomData],
  );
  await db.query(
    'insert into public.proposals(organization_id, lead_id) values($1, $2)',
    [organizationId, leadId],
  );
  await db.query(
    'insert into public.sales(organization_id, lead_id) values($1, $2)',
    [organizationId, leadId],
  );

  if (existingSourceMetadata) {
    await db.query(
      `insert into public.crm_clients(
        id, organization_id, name, company_nif, source, status, source_metadata
      ) values($1, $2, 'Cliente existente', '501234567', 'direct', 'active', $3)`,
      [existingClientId, organizationId, existingSourceMetadata],
    );
  }

  await db.exec('set role authenticated');
  return db;
}

const convert = (db) => db.query(
  'select * from public.convert_p2g_lead_to_client($1, $2)',
  [leadId, 'won'],
);

test('replacement preserves the production RPC argument names for named callers', async () => {
  const db = await createFixture();
  try {
    const identity = await db.query(`select pg_get_function_identity_arguments(
      'public.convert_p2g_lead_to_client(uuid,text)'::regprocedure
    ) as arguments`);
    assert.equal(identity.rows[0].arguments, '_lead uuid, _won_status text');

    const result = await db.query(
      `select client_id from public.convert_p2g_lead_to_client(
        _lead => $1,
        _won_status => $2
      )`,
      [leadId, 'won'],
    );
    assert.equal(result.rows[0].client_id.length, 36);
  } finally {
    await db.close();
  }
});

test('P2G client CRC is optional but any supplied value must keep the exact format', async () => {
  const db = await createFixture();
  try {
    await db.query(
      "insert into public.crm_clients(organization_id, name, status) values($1, 'Sem CRC', 'active')",
      [organizationId],
    );
    await assert.rejects(
      db.query(
        "insert into public.crm_clients(organization_id, name, status, crc_code) values($1, 'CRC inválido', 'active', '123')",
        [organizationId],
      ),
      /CRC|crc|check constraint/i,
    );
    await db.query(
      "insert into public.crm_clients(organization_id, name, status, crc_code) values($1, 'CRC válido', 'active', '1234-5678-9012')",
      [organizationId],
    );
  } finally {
    await db.close();
  }
});

test('authenticated conversion uses the guarded RPC after direct person writes are revoked', async () => {
  const db = await createFixture();
  try {
    await assert.rejects(
      db.query(`insert into public.client_people(
        organization_id, client_id, name, source
      ) values($1, $2, 'Acesso direto', 'manual')`, [organizationId, existingClientId]),
      /permission denied/i,
    );
    const result = (await convert(db)).rows[0];
    assert.equal(result.client_created, true);
    assert.equal((await db.query('select count(*)::int count from public.client_people')).rows[0].count, 3);
  } finally {
    await db.close();
  }
});

test('definer conversion retains caller organization, lead visibility and client permission checks', async () => {
  const db = await createFixture();
  try {
    await db.exec("select set_config('test.can_read_lead', 'false', false)");
    await assert.rejects(convert(db), /Lead indisponível/);
    await db.exec("select set_config('test.can_read_lead', 'true', false)");
    await db.exec("select set_config('test.has_module_permission', 'false', false)");
    await assert.rejects(convert(db), /permissão.*cliente|Cliente indisponível/i);
    assert.equal((await db.query('select count(*)::int count from public.crm_clients')).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('conversion carries MJ origin and CAE while keeping legal managers separate from decision makers', async () => {
  const db = await createFixture();
  try {
    const first = (await convert(db)).rows[0];
    const second = (await convert(db)).rows[0];
    assert.equal(first.client_id, second.client_id);
    assert.equal(first.client_created, true);
    assert.equal(second.client_created, false);

    const client = (await db.query(
      'select source_metadata, decision_makers from public.crm_clients where id=$1',
      [first.client_id],
    )).rows[0];
    assert.equal(client.source_metadata.source_portal, 'publicacoes.mj.pt');
    assert.equal(client.source_metadata.publication_date, '2026-10-20');
    assert.deepEqual(client.source_metadata.cae, { principal: '62010', secundarios: ['62020'] });
    assert.equal(client.decision_makers[0].name, 'Carla Decisora');

    const people = (await db.query(`
      select p.nif, array_agg(r.role order by r.role) roles
      from public.client_people p
      join public.client_person_roles r on r.person_id=p.id
      group by p.id, p.nif
      order by p.nif
    `)).rows;
    assert.deepEqual(people, [
      { nif: '111111111', roles: ['legal_manager', 'shareholder'] },
      { nif: '222222222', roles: ['shareholder'] },
      { nif: '333333333', roles: ['decision_maker'] },
    ]);
  } finally {
    await db.close();
  }
});

test('same-name people without NIF remain separate and retries use source lineage rather than a name merge', async () => {
  const customData = {
    metadata: {
      source_portal: 'publicacoes.mj.pt',
      publication_date: '2026-10-20',
      cae: { principal: '62010', secundarios: [] },
      gerentes: [{ nome: 'Mesmo Nome' }],
      socios: [{ nome: 'Mesmo Nome' }],
    },
  };
  const db = await createFixture({ customData });
  try {
    await convert(db);
    await convert(db);
    const rows = (await db.query(`
      select p.name, p.nif, p.source_ref, r.role
      from public.client_people p
      join public.client_person_roles r on r.person_id=p.id
      order by r.role
    `)).rows;
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.role), ['legal_manager', 'shareholder']);
    assert.ok(rows.every((row) => row.name === 'Mesmo Nome' && row.nif === null));
    assert.notEqual(rows[0].source_ref, rows[1].source_ref);
  } finally {
    await db.close();
  }
});

test('an existing manual CAE wins and the incoming official CAE is retained for explicit review', async () => {
  const existingSourceMetadata = {
    cae: { principal: '47110', secundarios: ['47120'] },
    cae_source: 'manual',
  };
  const db = await createFixture({ existingSourceMetadata });
  try {
    const result = (await convert(db)).rows[0];
    assert.equal(result.client_id, existingClientId);
    assert.equal(result.client_created, false);
    const metadata = (await db.query(
      'select source_metadata from public.crm_clients where id=$1',
      [existingClientId],
    )).rows[0].source_metadata;
    assert.deepEqual(metadata.cae, existingSourceMetadata.cae);
    assert.deepEqual(metadata.cae_review.incoming, { principal: '62010', secundarios: ['62020'] });
    assert.equal(metadata.cae_review.source_portal, 'publicacoes.mj.pt');
    assert.equal(metadata.origins.length, 1);
  } finally {
    await db.close();
  }
});

test('an existing client keeps its metadata when a converted lead has no decision maker', async () => {
  const existingSourceMetadata = {
    preserved: { owner: 'manual', value: 'keep-me' },
  };
  const customData = {
    metadata: {
      source_portal: 'publicacoes.mj.pt',
      publication_date: '2026-10-20',
    },
  };
  const db = await createFixture({ customData, existingSourceMetadata });
  try {
    const result = (await convert(db)).rows[0];
    assert.equal(result.client_id, existingClientId);
    const metadata = (await db.query(
      'select source_metadata from public.crm_clients where id=$1',
      [existingClientId],
    )).rows[0].source_metadata;
    assert.deepEqual(metadata.preserved, existingSourceMetadata.preserved);
    assert.equal(metadata.source_portal, 'publicacoes.mj.pt');
  } finally {
    await db.close();
  }
});

test('legacy people with invalid NIF or overlong contacts are normalized without aborting conversion', async () => {
  const rawName = `Pessoa ${'N'.repeat(210)}`;
  const rawPhone = '9'.repeat(41);
  const rawEmail = `${'e'.repeat(309)}@example.test`;
  const customData = {
    decision_makers: [{
      name: rawName,
      nif: '123',
      phone: rawPhone,
      email: rawEmail,
    }],
  };
  const db = await createFixture({ customData });
  try {
    await convert(db);
    const person = (await db.query(`
      select name, nif, phone, email, source_metadata
      from public.client_people
      where client_id in (select id from public.crm_clients where lead_id=$1)
    `, [leadId])).rows[0];
    assert.equal(person.name.length, 200);
    assert.equal(person.nif, null);
    assert.equal(person.phone.length, 40);
    assert.equal(person.email.length, 320);
    assert.deepEqual(person.source_metadata.legacy_input, {
      name: rawName,
      nif: '123',
      phone: rawPhone,
      email: rawEmail,
    });
  } finally {
    await db.close();
  }
});

test('same-NIF person merge preserves deduplicated lineage from every converted lead', async () => {
  const secondLeadId = '00000000-0000-4000-8000-000000000104';
  const db = await createFixture();
  try {
    await convert(db);
    await db.query(`insert into public.leads(
      id, organization_id, name, company_name, company_nif, assigned_to, source, custom_data, status
    ) values($1, $2, 'Segundo contacto', 'Empresa Exemplo', '501234567', $3, 'prospect', $4, 'new')`, [
      secondLeadId,
      organizationId,
      actorId,
      {
        metadata: {
          source_portal: 'segunda-origem.example',
          publication_date: '2026-10-21',
          gerentes: [{ nome: 'Ana Silva', nif: '111111111' }],
        },
      },
    ]);
    await db.query('select * from public.convert_p2g_lead_to_client($1, $2)', [secondLeadId, 'won']);
    const metadata = (await db.query(
      "select source_metadata from public.client_people where nif='111111111'",
    )).rows[0].source_metadata;
    assert.equal(metadata.group, 'gerentes');
    assert.equal(metadata.source_portal, 'publicacoes.mj.pt');
    assert.deepEqual(
      [...new Set(metadata.origins.map(origin => origin.lead_id))].sort(),
      [leadId, secondLeadId].sort(),
    );
    assert.equal(metadata.origins.filter(origin => origin.lead_id === secondLeadId).length, 1);
  } finally {
    await db.close();
  }
});

test('a role-write failure rolls back the client, metadata, links and lead status together', async () => {
  const db = await createFixture();
  try {
    await db.exec(`
      reset role;
      create function public.fail_shareholder_role() returns trigger language plpgsql as $$
      begin
        if new.role='shareholder' then raise exception 'shareholder denied'; end if;
        return new;
      end
      $$;
      create trigger fail_shareholder_role before insert on public.client_person_roles
      for each row execute function public.fail_shareholder_role();
      set role authenticated;
    `);
    await assert.rejects(convert(db), /shareholder denied/);
    assert.equal((await db.query('select count(*)::int count from public.crm_clients')).rows[0].count, 0);
    assert.equal((await db.query('select count(*)::int count from public.client_people')).rows[0].count, 0);
    assert.equal((await db.query('select status from public.leads where id=$1', [leadId])).rows[0].status, 'new');
    assert.equal((await db.query('select client_id from public.proposals')).rows[0].client_id, null);
  } finally {
    await db.close();
  }
});
