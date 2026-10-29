import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadTypescriptModule(path, injected = {}) {
  const moduleExports = {};
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  });
  new Function('require', 'exports', compiled)(
    (name) => injected[name] ?? require(name),
    moduleExports,
  );
  return moduleExports;
}

const certificate = loadTypescriptModule('src/lib/client-certificate.ts');
const people = loadTypescriptModule('src/lib/decision-makers.ts');

function loadClientHooksForPureContracts() {
  const moduleExports = {};
  const source = readFileSync('src/hooks/useClientEdpData.ts', 'utf8');
  const compiled = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  });
  new Function('require', 'exports', compiled)(() => ({}), moduleExports);
  return moduleExports;
}

test('CRC is optional for every client and a supplied code still uses the strict format', () => {
  assert.equal(certificate.certificateRequired(true), false);
  assert.equal(certificate.certificateRequired(false), false);
  assert.equal(certificate.CRC_PATTERN.test('1234-5678-9012'), true);
  assert.equal(certificate.CRC_PATTERN.test('123456789012'), false);
});

test('certificate history is parsed at the boundary and validity is not inferred from a lookup timestamp', () => {
  const row = {
    version_id: '00000000-0000-4000-8000-000000000201',
    organization_id: '00000000-0000-4000-8000-000000000202',
    client_id: '00000000-0000-4000-8000-000000000203',
    crc_code: '1234-5678-9012',
    certificate_data: null,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    source: 'manual',
    source_metadata: {},
    recorded_by: '00000000-0000-4000-8000-000000000204',
    recorded_at: '2026-10-28T10:00:00+00:00',
    is_current: true,
  };
  assert.deepEqual(certificate.parseCertificateHistory([row]), [row]);
  assert.equal(certificate.certificateValidity(row.valid_until, '2026-10-28'), 'valid');
  assert.equal(certificate.certificateValidity('2026-10-27', '2026-10-28'), 'expired');
  assert.equal(certificate.certificateValidity(null, '2026-10-28'), 'unknown');
  assert.throws(() => certificate.parseCertificateHistory([{ ...row, is_current: 'yes' }]));
});

test('client source metadata exposes primary CAE, source date and pending conflict without casts', () => {
  const value = {
    lead_source: 'prospect',
    prospect_id: '00000000-0000-4000-8000-000000000205',
    source_portal: 'publicacoes.mj.pt',
    publication_date: '2026-10-20',
    cae: { principal: '62010', secundarios: ['62020'] },
    cae_review: {
      incoming: { principal: '47110', secundarios: [] },
      source_portal: 'publicacoes.mj.pt',
      publication_date: '2026-10-21',
      lead_id: '00000000-0000-4000-8000-000000000206',
    },
    origins: [{
      lead_id: '00000000-0000-4000-8000-000000000206',
      lead_source: 'prospect',
      source_portal: 'publicacoes.mj.pt',
      publication_date: '2026-10-20',
    }],
  };
  assert.deepEqual(certificate.parseClientSourceMetadata(value), value);
  assert.equal(certificate.parseClientSourceMetadata({ cae: '62010' }), null);
});

test('new decision makers require name, phone and a valid email', () => {
  const complete = {
    name: 'Carla Decisora',
    role: 'Diretora Financeira',
    nif: '333333333',
    phone: '+351910000001',
    email: 'carla@example.test',
  };
  assert.equal(people.areDecisionMakersValid([complete]), true);
  for (const incomplete of [
    { ...complete, name: '' },
    { ...complete, phone: '' },
    { ...complete, email: '' },
    { ...complete, email: 'invalid' },
  ]) {
    assert.equal(people.areDecisionMakersValid([incomplete]), false);
  }
});

test('an untouched incomplete legacy decision maker allows unrelated edits but any decision-maker edit must complete it', () => {
  const legacy = [{
    id: '00000000-0000-4000-8000-000000000207',
    name: 'Legado',
    role: '',
    nif: null,
    phone: '',
    email: '',
    source: 'legacy',
  }];
  assert.equal(people.areDecisionMakerChangesValid(legacy, legacy), true);
  assert.equal(people.areDecisionMakerChangesValid([{ ...legacy[0], role: 'Gerente' }], legacy), false);
  assert.equal(people.areDecisionMakerChangesValid([{
    ...legacy[0],
    role: 'Gerente',
    phone: '+351910000001',
    email: 'legado@example.test',
  }], legacy), true);
  assert.equal(people.areDecisionMakerChangesValid([], legacy), false);
});

test('person-role payload reuses normalized NIF or stable id, never a name-only match', () => {
  const decisionMakers = [{
    name: 'Ana Silva',
    role: 'Diretora',
    nif: '111 111 111',
    phone: '+351910000001',
    email: 'ana@example.test',
  }, {
    name: 'Mesmo Nome',
    role: 'Compras',
    nif: null,
    phone: '+351910000002',
    email: 'compras@example.test',
  }];
  const legalManagers = [{
    name: 'Ana Silva',
    nif: '111111111',
    phone: '+351910000001',
    email: 'ana@example.test',
  }, {
    name: 'Mesmo Nome',
    nif: null,
    phone: '+351910000003',
    email: 'gerencia@example.test',
  }];
  const payload = people.buildClientPeoplePayload(decisionMakers, legalManagers);
  assert.equal(payload.length, 3);
  assert.deepEqual(payload[0].roles, ['decision_maker', 'legal_manager']);
  assert.deepEqual(payload[1].roles, ['decision_maker']);
  assert.deepEqual(payload[2].roles, ['legal_manager']);
});

test('person-role edits round-trip person metadata and preserve source per role', () => {
  const shared = {
    person_id: '00000000-0000-4000-8000-000000000209',
    organization_id: '00000000-0000-4000-8000-000000000202',
    client_id: '00000000-0000-4000-8000-000000000203',
    name: 'Pessoa com duas funções',
    nif: '111111111',
    phone: '+351910000001',
    email: 'pessoa@example.test',
    person_source: 'legacy',
    source_ref: 'lead:fixture:decision_makers:1',
    source_metadata: {
      role: 'Diretora',
      legacy_entries: [{ index: 1, name: 'Pessoa com duas funções' }],
    },
    is_complete: true,
    created_at: '2026-10-28T10:00:00+00:00',
    updated_at: '2026-10-28T10:00:00+00:00',
  };
  const rows = people.parseClientPersonRoleRows([
    { ...shared, role: 'decision_maker', role_source: 'legacy' },
    { ...shared, role: 'legal_manager', role_source: 'mj' },
  ]);
  const payload = people.buildClientPeoplePayload(
    people.decisionMakersFromRows(rows),
    people.legalManagersFromRows(rows),
  );
  assert.equal(payload.length, 1);
  assert.equal(payload[0].source_ref, shared.source_ref);
  assert.deepEqual(payload[0].source_metadata, shared.source_metadata);
  assert.deepEqual(payload[0].role_sources, {
    decision_maker: 'legacy',
    legal_manager: 'mj',
  });
  const serialized = loadClientHooksForPureContracts().clientPeoplePayloadJson(payload);
  assert.deepEqual(serialized[0].role_sources, payload[0].role_sources);
});

test('conflicting contacts for the same fiscal person must be reviewed instead of silently choosing one', () => {
  const decisionMakers = [{
    name: 'Ana Silva',
    role: '',
    nif: '111111111',
    phone: '+351910000001',
    email: 'ana@example.test',
  }];
  const legalManagers = [{
    name: 'Ana Silva',
    nif: '111111111',
    phone: '+351910000009',
    email: 'ana@example.test',
  }];
  assert.equal(people.hasClientPeopleContactConflict(decisionMakers, legalManagers), true);
});

test('CRC managers reuse a matching NIF without erasing manual contacts and do not merge name-only homonyms', () => {
  const current = [{
    name: 'Ana Manual',
    nif: '111111111',
    phone: '+351910000001',
    email: 'ana@example.test',
    source: 'manual',
  }];
  const merged = people.mergeCertificateLegalManagers(current, [
    { nome: 'Ana Oficial', nif: '111 111 111' },
    { nome: 'Mesmo Nome', nif: null },
    { nome: 'Mesmo Nome', nif: null },
  ]);
  assert.deepEqual(merged, [
    current[0],
    { name: 'Mesmo Nome', nif: null, phone: '', email: '', source: 'crc_lookup', roleSource: 'crc_lookup' },
    { name: 'Mesmo Nome', nif: null, phone: '', email: '', source: 'crc_lookup', roleSource: 'crc_lookup' },
  ]);
});

test('atomic client RPC responses expose the nested client identity to form callbacks', () => {
  const hooks = loadClientHooksForPureContracts();
  assert.deepEqual(hooks.parseClientMutationResult({
    client: { id: '00000000-0000-4000-8000-000000000208' },
    people: [],
  }, 'criar o cliente'), { id: '00000000-0000-4000-8000-000000000208' });
  assert.throws(() => hooks.parseClientMutationResult({ people: [] }, 'criar o cliente'));
});
