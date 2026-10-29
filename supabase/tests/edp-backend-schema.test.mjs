import assert from 'node:assert/strict';
import test from 'node:test';
import { asUser, createEdpDatabase, IDS } from './edp-backend-testkit.mjs';

test('legacy people backfill preserves malformed NIF evidence and deduplicates only valid NIFs', async () => {
  const legacyClient = '30000000-0000-4000-8000-000000000099';
  const longName = 'N'.repeat(201);
  const longPhone = '9'.repeat(41);
  const longEmail = `${'e'.repeat(308)}@example.test`;
  const legacyPeople = JSON.stringify([
    { name: 'NIF curto', nif: '123', phone: '910000001', email: 'curto@example.test' },
    { name: 'NIF vazio', nif: '', phone: '910000002', email: 'vazio@example.test' },
    { name: 'NIF formatado', nif: '123 456 789', phone: '', email: '' },
    { name: 'NIF duplicado', nif: '123456789', phone: '910000004', email: 'duplicado@example.test' },
    { name: longName, nif: '456', phone: longPhone, email: longEmail },
  ]);
  const db = await createEdpDatabase({
    beforeMigration: async (database) => {
      await database.exec(`
        insert into public.organizations values('${IDS.org}','Org local');
        insert into auth.users values('${IDS.seller}');
        insert into public.organization_members(user_id,organization_id,is_active)
          values('${IDS.seller}','${IDS.org}',true);
        insert into public.crm_clients(id,organization_id,name,decision_makers,assigned_to,created_by,crc_code,certificate_data)
        values('${legacyClient}','${IDS.org}','Cliente legado','${legacyPeople}','${IDS.seller}','${IDS.seller}','1234-5678-9012','[]');
      `);
    },
  });
  try {
    assert.equal(
      (await db.query(`select count(*)::int as n from public.client_people where client_id='${legacyClient}'`)).rows[0].n,
      4,
    );
    assert.deepEqual(
      (await db.query(`select name,nif,source_metadata->>'legacy_raw_nif' as raw_nif from public.client_people where client_id='${legacyClient}' order by source_ref`)).rows,
      [
        { name: 'NIF curto', nif: null, raw_nif: '123' },
        { name: 'NIF vazio', nif: null, raw_nif: null },
        { name: 'NIF formatado', nif: '123456789', raw_nif: '123 456 789' },
        { name: longName.slice(0, 200), nif: null, raw_nif: '456' },
      ],
    );
    assert.deepEqual(
      (await db.query(`select phone,email from public.client_people where client_id='${legacyClient}' and nif='123456789'`)).rows,
      [{ phone: '910000004', email: 'duplicado@example.test' }],
    );
    const preserved = (await db.query(`select char_length(name)::int as name_length,char_length(phone)::int as phone_length,
      char_length(email)::int as email_length,source_metadata->'legacy_entries'->0->>'name' as raw_name,
      source_metadata->'legacy_entries'->0->>'phone' as raw_phone,source_metadata->'legacy_entries'->0->>'email' as raw_email
      from public.client_people where client_id='${legacyClient}' and source_ref='decision_makers:5'`)).rows[0];
    assert.deepEqual(
      { name_length: preserved.name_length, phone_length: preserved.phone_length, email_length: preserved.email_length },
      { name_length: 200, phone_length: 40, email_length: 320 },
    );
    assert.deepEqual(
      { raw_name: preserved.raw_name, raw_phone: preserved.raw_phone, raw_email: preserved.raw_email },
      { raw_name: longName, raw_phone: longPhone, raw_email: longEmail },
    );
    assert.deepEqual(
      (await db.query(`select crc_code,certificate_data,source_metadata from public.client_certificate_versions where client_id='${legacyClient}'`)).rows,
      [{ crc_code: '1234-5678-9012', certificate_data: {}, source_metadata: { legacy_certificate_data: [] } }],
    );
    assert.equal(
      (await db.query(`select count(*)::int as n from public.client_person_roles where client_id='${legacyClient}' and role='decision_maker'`)).rows[0].n,
      4,
    );
  } finally {
    await db.close();
  }
});

test('client people keep legal manager distinct and enforce current client scope', async () => {
  const db = await createEdpDatabase();
  try {
    const saved = await asUser(db, IDS.seller, `select public.save_client_people_roles(
      '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}',
      '[{"name":"Ana Silva","nif":"123456789","phone":"910000000","email":"ana@example.test","source":"manual","roles":["decision_maker","legal_manager"]}]'
    ) as value`);
    assert.equal(saved.rows[0].value.people.length, 2);
    assert.equal((await db.query(`select count(*)::int as n from public.client_people where client_id='${IDS.client}'`)).rows[0].n, 1);
    assert.deepEqual(
      (await db.query(`select role from public.client_person_roles where client_id='${IDS.client}' order by role`)).rows,
      [{ role: 'decision_maker' }, { role: 'legal_manager' }],
    );
    assert.equal((await asUser(db, IDS.otherSeller, 'select * from public.client_people')).rows.length, 0);
    assert.equal((await asUser(db, IDS.admin, 'select * from public.client_people')).rows.length, 1);
    await assert.rejects(
      asUser(db, IDS.seller, `select public.save_client_people_roles('${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}','[{"name":"Incompleta","source":"manual","roles":["decision_maker"]}]')`),
      /completo/i,
    );
  } finally {
    await db.close();
  }
});

test('authenticated callers cannot bypass RPC invariants with direct table writes', async () => {
  const db = await createEdpDatabase();
  try {
    await assert.rejects(
      asUser(db, IDS.seller, `insert into public.client_people(organization_id,client_id,name,source)
        values('${IDS.org}','${IDS.client}','Bypass','manual')`),
      /permission denied/i,
    );
    await assert.rejects(
      asUser(db, IDS.admin, `insert into public.edp_settings(organization_id,subject_template,body_template,recipients,sender_name,sender_email)
        values('${IDS.org}','x','x','[]','x','x@example.test')`),
      /permission denied/i,
    );
    await assert.rejects(
      asUser(db, IDS.seller, `insert into public.edp_sale_drafts(sale_id,organization_id,client_id,revision,payload,readiness,updated_by)
        values('${IDS.sale}','${IDS.org}','${IDS.client}',1,'{}','draft','${IDS.seller}')`),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});

test('security-definer client mutations preserve add and edit module permissions', async () => {
  const db = await createEdpDatabase();
  const profileId = '21000000-0000-4000-8000-000000000010';
  const clientId = '30000000-0000-4000-8000-000000000010';
  const saleId = '40000000-0000-4000-8000-000000000010';
  const personId = '31000000-0000-4000-8000-000000000010';
  try {
    await db.exec(`
      insert into public.organization_profiles(id,organization_id,base_role,module_permissions)
      values('${profileId}','${IDS.org}','salesperson','{"clients":{"subareas":{"list":{"add":false,"edit":false}}}}');
      update public.organization_members set profile_id='${profileId}' where user_id='${IDS.otherSeller}' and organization_id='${IDS.org}';
      insert into public.crm_clients(id,organization_id,name,assigned_to,created_by)
      values('${clientId}','${IDS.org}','Cliente sem permissão','${IDS.otherSeller}','${IDS.otherSeller}');
      insert into public.sales(id,organization_id,client_id,created_by) values('${saleId}','${IDS.org}','${clientId}','${IDS.otherSeller}');
      insert into public.client_people(id,organization_id,client_id,name,phone,email,source,created_by)
      values('${personId}','${IDS.org}','${clientId}','Pessoa','910000009','pessoa@example.test','manual','${IDS.otherSeller}');
      insert into public.client_person_roles(person_id,client_id,organization_id,role,source)
      values('${personId}','${clientId}','${IDS.org}','decision_maker','manual');
    `);
    await assert.rejects(
      asUser(db, IDS.otherSeller, `select public.create_client_with_people(
        '{"name":"Criar sem permissão"}',
        '[{"name":"Pessoa","phone":"910000008","email":"nova@example.test","source":"manual","roles":["decision_maker"]}]'
      )`),
      /permissão/i,
    );
    await assert.rejects(
      asUser(db, IDS.otherSeller, `select public.save_client_people_roles(
        '${clientId}',(select updated_at from public.crm_clients where id='${clientId}'),'{}',
        '[{"id":"${personId}","name":"Pessoa","phone":"910000009","email":"pessoa@example.test","source":"manual","roles":["decision_maker"]}]'
      )`),
      /permissão/i,
    );
    await assert.rejects(
      asUser(db, IDS.otherSeller, `select public.renew_client_certificate('${clientId}',null,'1234-5678-9012','{}')`),
      /permissão/i,
    );
    const payload = JSON.stringify({
      energy_type: 'ee', proposal_number: '', supply_points: [], responsible_person_id: personId,
      responsible: { name: 'Pessoa', phone: '910000009', email: 'pessoa@example.test' }, confirm_client_contact_sync: true,
      certificate_version_id: null, direct_debit: null, electronic_invoice: null, billing_email: null,
      selected_document_version_ids: [], checklist_confirmations: [], paid_extraction_requested: false,
    });
    await assert.rejects(
      asUser(db, IDS.otherSeller, `select public.edp_save_draft('${saleId}',0,'${payload}')`),
      /permissão/i,
    );
  } finally {
    await db.close();
  }
});

test('EDP actor matrix allows admin, BO and responsible commercial but denies every other scope', async () => {
  const db = await createEdpDatabase();
  const commercialProfile = '21000000-0000-4000-8000-000000000020';
  const payload = JSON.stringify({
    energy_type: 'ee', proposal_number: '', supply_points: [], responsible_person_id: null, responsible: null,
    confirm_client_contact_sync: false, certificate_version_id: null, direct_debit: null, electronic_invoice: null,
    billing_email: null, selected_document_version_ids: [], checklist_confirmations: [], paid_extraction_requested: false,
  });
  try {
    await db.exec(`
      insert into public.organization_profiles(id,organization_id,name,base_role,module_permissions,data_scope)
      values('${commercialProfile}','${IDS.org}','Comercial','salesperson',
        '{"sales":{"subareas":{"sales":{"edit":false}}},"clients":{"subareas":{"list":{"edit":false}}}}','own');
      update public.organization_members set profile_id='${commercialProfile}'
      where user_id='${IDS.seller}' and organization_id='${IDS.org}';
    `);
    await asUser(db, IDS.admin, `select public.edp_save_draft('${IDS.sale}',0,'${payload}')`);
    await asUser(db, IDS.bo, `select public.edp_save_draft('${IDS.sale}',1,'${payload}')`);
    await asUser(db, IDS.seller, `select public.edp_save_draft('${IDS.sale}',2,'${payload}')`);
    for (const deniedUser of [IDS.viewer, IDS.otherSeller, IDS.outsider]) {
      await assert.rejects(
        asUser(db, deniedUser, `select public.edp_save_draft('${IDS.sale}',3,'${payload}')`),
        /venda|permissão/i,
      );
    }
    for (const allowedUser of [IDS.admin, IDS.bo, IDS.seller]) {
      await asUser(db, allowedUser, `select public.edp_assert_client_document_write('${IDS.client}')`);
    }
    for (const deniedUser of [IDS.viewer, IDS.otherSeller, IDS.outsider]) {
      await assert.rejects(
        asUser(db, deniedUser, `select public.edp_assert_client_document_write('${IDS.client}')`),
        /permissão/i,
      );
    }
    await db.exec('set role anon');
    try {
      await assert.rejects(
        db.query(`select public.edp_save_draft('${IDS.sale}',3,'${payload}')`),
        /permission denied/i,
      );
    } finally {
      await db.exec('reset role');
    }
  } finally {
    await db.close();
  }
});

test('incomplete legacy person exemption requires every protected field and role to remain equivalent', async () => {
  const db = await createEdpDatabase();
  const personId = '31000000-0000-4000-8000-000000000001';
  const unchanged = `[{"id":"${personId}","name":"Legada Incompleta","nif":null,"phone":"","email":"","source":"legacy","source_metadata":{"legacy_index":1,"role_title":"Gerente"},"roles":["decision_maker"]}]`;
  try {
    await db.exec(`
      insert into public.client_people(id,organization_id,client_id,name,source,source_metadata,created_by)
        values('${personId}','${IDS.org}','${IDS.client}','Legada Incompleta','legacy','{"legacy_index":1,"role_title":"Gerente"}','${IDS.seller}');
      insert into public.client_person_roles(person_id,client_id,organization_id,role,source)
        values('${personId}','${IDS.client}','${IDS.org}','decision_maker','legacy');
    `);
    const saved = await asUser(db, IDS.seller, `select public.save_client_people_roles(
      '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}','${unchanged}'
    ) as value`);
    assert.equal(saved.rows[0].value.people[0].is_complete, false);
    const metadataOmitted = unchanged.replace(',"source_metadata":{"legacy_index":1,"role_title":"Gerente"}', '');
    const omittedResult = await asUser(db, IDS.seller, `select public.save_client_people_roles(
      '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}','${metadataOmitted}'
    ) as value`);
    assert.equal(omittedResult.rows[0].value.people[0].is_complete, false);

    const mutations = [
      unchanged.replace('"nif":null', '"nif":"123456789"'),
      unchanged.replace('"source":"legacy"', '"source":"manual"'),
      unchanged.replace('["decision_maker"]', '["decision_maker","legal_manager"]'),
    ];
    for (const changed of mutations) {
      await assert.rejects(
        asUser(db, IDS.seller, `select public.save_client_people_roles(
          '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}','${changed}'
        )`),
        /completos/i,
      );
    }
    const forgedMetadata = unchanged.replace('"role_title":"Gerente"', '"role_title":"Administrador"');
    await assert.rejects(
      asUser(db, IDS.seller, `select public.save_client_people_roles(
        '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}','${forgedMetadata}'
      )`),
      /proveniência/i,
    );
  } finally {
    await db.close();
  }
});

test('saving a mixed-provenance person preserves each existing role source', async () => {
  const db = await createEdpDatabase();
  const personId = '31000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      insert into public.client_people(id,organization_id,client_id,name,phone,email,source,created_by)
        values('${personId}','${IDS.org}','${IDS.client}','Pessoa Mista','910000005','mista@example.test','legacy','${IDS.seller}');
      insert into public.client_person_roles(person_id,client_id,organization_id,role,source)
        values('${personId}','${IDS.client}','${IDS.org}','decision_maker','legacy');
    `);
    await asUser(db, IDS.seller, `select public.save_client_people_roles(
      '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}',
      '[{"id":"${personId}","name":"Pessoa Mista","phone":"910000005","email":"mista@example.test","source":"legacy","roles":["decision_maker","legal_manager"],"role_sources":{"decision_maker":"legacy","legal_manager":"mj"}}]'
    )`);
    await asUser(db, IDS.seller, `select public.save_client_people_roles(
      '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}',
      '[{"id":"${personId}","name":"Pessoa Mista","phone":"910000005","email":"mista@example.test","source":"legacy","roles":["decision_maker","legal_manager"]}]'
    )`);
    assert.deepEqual(
      (await db.query(`select role,source from public.client_person_roles where person_id='${personId}' order by role`)).rows,
      [{ role: 'decision_maker', source: 'legacy' }, { role: 'legal_manager', source: 'mj' }],
    );
    await assert.rejects(
      asUser(db, IDS.seller, `select public.save_client_people_roles(
        '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}',
        '[{"id":"${personId}","name":"Pessoa Mista","phone":"910000005","email":"mista@example.test","source":"legacy","source_metadata":{"forged_origin":"other"},"roles":["decision_maker","legal_manager"]}]'
      )`),
      /proveniência/i,
    );
    assert.deepEqual(
      (await db.query(`select source_metadata from public.client_people where id='${personId}'`)).rows,
      [{ source_metadata: {} }],
    );
    await asUser(db, IDS.seller, `select public.save_client_people_roles(
      '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}',
      '[{"id":"${personId}","name":"Pessoa Mista","phone":"910000005","email":"mista@example.test","source":"legacy","source_metadata":{"role":"Gerente"},"roles":["decision_maker","legal_manager"]}]'
    )`);
    assert.deepEqual(
      (await db.query(`select source_metadata from public.client_people where id='${personId}'`)).rows,
      [{ source_metadata: { role: 'Gerente' } }],
    );
  } finally {
    await db.close();
  }
});

test('client creation and role writes are atomic', async () => {
  const db = await createEdpDatabase();
  try {
    await assert.rejects(
      asUser(db, IDS.seller, `select public.create_client_with_people('{"name":"Parcial","assigned_to":"${IDS.seller}"}','[{"name":"Sem email","phone":"910000000","source":"manual","roles":["decision_maker"]}]')`),
      /completo/i,
    );
    assert.equal((await db.query("select count(*)::int as n from public.crm_clients where name='Parcial'")).rows[0].n, 0);
    await assert.rejects(
      asUser(db, IDS.seller, `select public.create_client_with_people('{"name":"Sem decisor","assigned_to":"${IDS.seller}","crc_code":null,"certificate_data":null,"certificate_checked_at":null}','[]')`),
      /decisor/i,
    );
    await assert.rejects(
      asUser(db, IDS.seller, `select public.save_client_people_roles('${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}','[]')`),
      /decisor/i,
    );
    const result = await asUser(db, IDS.seller, `select public.create_client_with_people(
      '{"name":"Criada","assigned_to":"${IDS.seller}","company_nif":"508888888","crc_code":"1111-2222-3333","certificate_data":{"issuer":"fixture"}}',
      '[{"name":"Decisora","phone":"910000001","email":"decisora@example.test","source":"manual","roles":["decision_maker"]}]'
    ) as value`);
    assert.equal(result.rows[0].value.client.name, 'Criada');
    assert.equal(result.rows[0].value.people.length, 1);
    const createdId = result.rows[0].value.client.id;
    assert.deepEqual(
      (await asUser(db, IDS.seller, `select crc_code,is_current from public.client_certificate_history where client_id='${createdId}'`)).rows,
      [{ crc_code: '1111-2222-3333', is_current: true }],
    );
    const withoutCertificate = await asUser(db, IDS.seller, `select public.create_client_with_people(
      '{"name":"Sem CRC","assigned_to":"${IDS.seller}","crc_code":null,"certificate_data":null,"certificate_checked_at":null}',
      '[{"name":"Decisora Dois","phone":"910000002","email":"decisora2@example.test","source":"manual","roles":["decision_maker"]}]'
    ) as value`);
    assert.equal(
      (await db.query(`select count(*)::int as n from public.client_certificate_versions where client_id='${withoutCertificate.rows[0].value.client.id}'`)).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test('CRC renewal preserves ordered immutable history and rejects stale expected version', async () => {
  const db = await createEdpDatabase();
  try {
    const first = await asUser(db, IDS.seller, `select id from public.renew_client_certificate('${IDS.client}',null,'1234-5678-9012','{}',null,'2027-10-28','manual','{}')`);
    const firstId = first.rows[0].id;
    const second = await asUser(db, IDS.seller, `select id from public.renew_client_certificate('${IDS.client}','${firstId}','9999-8888-7777','{}',null,'2028-10-28','manual','{}')`);
    assert.notEqual(second.rows[0].id, firstId);
    assert.deepEqual(
      (await asUser(db, IDS.seller, `select crc_code,is_current from public.client_certificate_history where client_id='${IDS.client}' order by recorded_at,id`)).rows,
      [{ crc_code: '1234-5678-9012', is_current: false }, { crc_code: '9999-8888-7777', is_current: true }],
    );
    await assert.rejects(
      asUser(db, IDS.seller, `select * from public.renew_client_certificate('${IDS.client}','${firstId}','1111-2222-3333','{}',null,'2029-10-28','manual','{}')`),
      /conflict/i,
    );
    await assert.rejects(
      asUser(db, IDS.seller, `update public.crm_clients set crc_code='1111-2222-3333',certificate_data='{"bypass":true}' where id='${IDS.client}'`),
      /renewal/i,
    );
    assert.deepEqual(
      (await db.query(`select crc_code,certificate_data from public.crm_clients where id='${IDS.client}'`)).rows,
      [{ crc_code: '9999-8888-7777', certificate_data: {} }],
    );
  } finally {
    await db.close();
  }
});

test('contact synchronization rejects a missing responsible without clearing stored contacts', async () => {
  const db = await createEdpDatabase();
  try {
    const person = await asUser(db, IDS.seller, `select (public.save_client_people_roles(
      '${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}',
      '[{"name":"Ana","phone":"910000000","email":"ana@example.test","source":"manual","roles":["decision_maker"]}]'
    )->'people'->0->>'person_id')::uuid as id`);
    const payload = JSON.stringify({
      energy_type: 'ee', proposal_number: '', supply_points: [], responsible_person_id: person.rows[0].id,
      responsible: null, confirm_client_contact_sync: true, certificate_version_id: null, direct_debit: null,
      electronic_invoice: null, billing_email: null, selected_document_version_ids: [], checklist_confirmations: [],
      paid_extraction_requested: false,
    });
    await assert.rejects(
      asUser(db, IDS.seller, `select public.edp_save_draft('${IDS.sale}',0,'${payload}')`),
      /responsável/i,
    );
    assert.deepEqual(
      (await db.query(`select phone,email from public.client_people where id='${person.rows[0].id}'`)).rows,
      [{ phone: '910000000', email: 'ana@example.test' }],
    );
  } finally {
    await db.close();
  }
});

test('private document rows and objects deny an unrelated commercial', async () => {
  const db = await createEdpDatabase();
  try {
    await db.exec(`
      insert into public.client_documents(id,organization_id,client_id,category,label,created_by) values('${IDS.document}','${IDS.org}','${IDS.client}','identity','Documento','${IDS.seller}');
      insert into public.client_document_versions(id,document_id,organization_id,client_id,side,bucket_id,storage_path,original_name,mime_type,size_bytes,sha256,created_by)
      values('${IDS.documentVersion}','${IDS.document}','${IDS.org}','${IDS.client}','single','edp-client-documents','${IDS.org}/${IDS.client}/${IDS.document}/${IDS.documentVersion}.pdf','doc.pdf','application/pdf',5,repeat('a',64),'${IDS.seller}');
      insert into storage.objects(bucket_id,name,owner_id) values('edp-client-documents','${IDS.org}/${IDS.client}/${IDS.document}/${IDS.documentVersion}.pdf','${IDS.seller}');
    `);
    assert.equal((await asUser(db, IDS.seller, "select count(*)::int as n from storage.objects where bucket_id='edp-client-documents'")).rows[0].n, 1);
    assert.equal((await asUser(db, IDS.otherSeller, "select count(*)::int as n from storage.objects where bucket_id='edp-client-documents'")).rows[0].n, 0);
    assert.equal((await asUser(db, IDS.outsider, "select count(*)::int as n from public.client_document_versions")).rows[0].n, 0);
    await assert.rejects(
      asUser(db, IDS.viewer, `select public.edp_archive_document('${IDS.document}')`),
      /permissão/i,
    );
    await assert.rejects(
      asUser(db, IDS.otherSeller, `select public.edp_archive_document('${IDS.document}')`),
      /documento|permissão/i,
    );
    await asUser(db, IDS.seller, `select public.edp_archive_document('${IDS.document}')`);
    assert.equal((await db.query(`select archived_at is not null as archived from public.client_documents where id='${IDS.document}'`)).rows[0].archived, true);
  } finally {
    await db.close();
  }
});

test('settings are admin-only and dispatch reservation is stable across unknown results', async () => {
  const db = await createEdpDatabase();
  try {
    await assert.rejects(
      asUser(db, IDS.seller, "select public.edp_save_settings(0,'{\"subject_template\":\"EDP {{proposal_number}}\",\"body_template\":\"<p>{{client_name}}</p>\",\"to\":[\"edp@example.test\"],\"cc\":[],\"sender_name\":\"P2G\",\"sender_email\":\"local@example.test\"}','[]')"),
      /administrador/i,
    );
    await assert.rejects(
      asUser(db, IDS.admin, "select public.edp_save_settings(0,'{\"subject_template\":\"EDP {{bad-name}}\",\"body_template\":\"<p>{{client_name}}</p>\",\"to\":[\"edp@example.test\"],\"cc\":[],\"sender_name\":\"P2G\",\"sender_email\":\"local@example.test\"}','[]')"),
      /variável/i,
    );
    await asUser(db, IDS.admin, "select public.edp_save_settings(0,'{\"subject_template\":\"EDP {{ proposal_number }}\",\"body_template\":\"<p>{{ client_name }}</p>\",\"to\":[\"edp@example.test\"],\"cc\":[\"bo@example.test\"],\"sender_name\":\"P2G\",\"sender_email\":\"local@example.test\",\"send_enabled\":true,\"transport\":\"local_capture\"}','[]')");
    const person = await asUser(db, IDS.seller, `select (public.save_client_people_roles('${IDS.client}',(select updated_at from public.crm_clients where id='${IDS.client}'),'{}','[{"name":"Ana","phone":"910000000","email":"ana@example.test","source":"manual","roles":["decision_maker"]}]')->'people'->0->>'person_id')::uuid as id`);
    const personId = person.rows[0].id;
    const cert = await asUser(db, IDS.seller, `select id from public.renew_client_certificate('${IDS.client}',null,'1234-5678-9012','{}',null,'2027-10-28','manual','{}')`);
    const payload = JSON.stringify({ energy_type: 'ee', proposal_number: 'SF-1', supply_points: [{ kind: 'cpe', code: 'PT0002', contract_start_date: '2026-11-01' }], responsible_person_id: personId, responsible: { name: 'Ana', phone: '910000000', email: 'ana@example.test' }, confirm_client_contact_sync: false, certificate_version_id: cert.rows[0].id, direct_debit: true, electronic_invoice: false, billing_email: null, selected_document_version_ids: [], checklist_confirmations: [], paid_extraction_requested: false });
    const draft = await asUser(db, IDS.seller, `select public.edp_save_draft('${IDS.sale}',0,'${payload.replaceAll("'", "''")}') as value`);
    assert.equal(draft.rows[0].value.readiness, 'ready');
    const first = await asUser(db, IDS.seller, `select public.edp_reserve_dispatch('${IDS.sale}',1,'${IDS.idempotency}') as value`);
    assert.equal(first.rows[0].value.snapshot.delivery.subject, 'EDP SF-1');
    assert.equal(first.rows[0].value.snapshot.delivery.html, '<p>Cliente A</p>');
    const replay = await asUser(db, IDS.seller, `select public.edp_reserve_dispatch('${IDS.sale}',1,'${IDS.idempotency}') as value`);
    assert.equal(replay.rows[0].value.dispatch_id, first.rows[0].value.dispatch_id);
    assert.equal(replay.rows[0].value.same_request, true);
    for (const allowedUser of [IDS.admin, IDS.bo]) {
      const privilegedReplay = await asUser(db, allowedUser, `select public.edp_reserve_dispatch('${IDS.sale}',1,'${IDS.idempotency}') as value`);
      assert.equal(privilegedReplay.rows[0].value.same_request, true);
    }
    await assert.rejects(
      asUser(db, IDS.viewer, `select public.edp_reserve_dispatch('${IDS.sale}',1,'${IDS.idempotency}')`),
      /permissão/i,
    );
    await assert.rejects(
      asUser(db, IDS.seller, `select public.edp_reserve_dispatch('${IDS.sale}',999,'${IDS.idempotency}')`),
      /revision/i,
    );
    await asUser(db, IDS.admin, "select public.edp_save_settings(1,'{\"subject_template\":\"EDP {{proposal_number}}\",\"body_template\":\"<p>{{client_name}}</p>\",\"to\":[\"edp@example.test\"],\"cc\":[],\"sender_name\":\"P2G\",\"sender_email\":\"local@example.test\",\"send_enabled\":false,\"transport\":\"local_capture\"}','[]')");
    await assert.rejects(
      asUser(db, IDS.seller, `select public.edp_reserve_dispatch('${IDS.sale}',1,'${IDS.idempotency}')`),
      /disabled/i,
    );
    await asUser(db, IDS.admin, "select public.edp_save_settings(2,'{\"subject_template\":\"EDP {{proposal_number}}\",\"body_template\":\"<p>{{client_name}}</p>\",\"to\":[\"edp@example.test\"],\"cc\":[],\"sender_name\":\"P2G\",\"sender_email\":\"local@example.test\",\"send_enabled\":true,\"transport\":\"local_capture\"}','[]')");
    await db.exec(`update public.edp_dispatches set state='uncertain' where id='${first.rows[0].value.dispatch_id}'`);
    const uncertainReplay = await asUser(db, IDS.seller, `select public.edp_reserve_dispatch('${IDS.sale}',1,'${IDS.idempotency}') as value`);
    assert.equal(uncertainReplay.rows[0].value.state, 'uncertain');
    await assert.rejects(
      asUser(db, IDS.seller, `select public.edp_reserve_dispatch('${IDS.sale}',1,'70000000-0000-4000-8000-000000000099')`),
      /uncertain/i,
    );
  } finally {
    await db.close();
  }
});
