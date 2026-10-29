import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadTypescriptModule(path, injected = {}) {
  const moduleExports = {};
  const moduleRequire = (name) => injected[name] ?? require(name);
  const source = fs.readFileSync(path, 'utf8');
  const compiled = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  });
  new Function('require', 'exports', compiled)(moduleRequire, moduleExports);
  return moduleExports;
}

const certificateModule = loadTypescriptModule('src/lib/client-certificate.ts');
const persistence = loadTypescriptModule('src/lib/client-form-persistence.ts', {
  './client-certificate': certificateModule,
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); },
  };
}

const scope = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  formContext: 'create',
};

const certificate = {
  nipc: '501234567',
  denominacao: 'Empresa Exemplo',
  cae: [{ codigo: '62010', descricao: 'Programação', principal: true }],
  gerentes: [{ nome: 'Ana Silva', nif: '123456789' }],
  ok: true,
};

const draft = {
  name: 'Empresa Exemplo',
  email: 'geral@exemplo.pt',
  phone: '912345678',
  company: 'Empresa Exemplo',
  nif: '',
  decisionMakers: [{ name: 'Ana Silva', role: 'Gerente', phone: '912345678', email: 'ana@exemplo.pt' }],
  companyNif: '501234567',
  crcCode: '1234-5678-9012',
  certificateData: certificate,
  certificateCheckedAt: '2026-10-23T10:00:00+01:00',
  billingTarget: 'company',
  status: 'active',
  source: 'direct',
  notes: 'Contactar de manhã',
  assignedTo: '33333333-3333-4333-8333-333333333333',
  addressLine1: 'Rua Central, 1',
  addressLine2: '2.º Esq.',
  city: 'Lisboa',
  postalCode: '1000-001',
  country: 'PT',
  distrito: 'Lisboa',
  conselho: 'Lisboa',
  grupoEconomico: 'Grupo Exemplo',
};

test('draft survives close/reload only inside the exact user, organization and form scope', () => {
  const storage = memoryStorage();
  assert.deepEqual(persistence.saveClientFormDraft(storage, scope, draft, 1_000), { kind: 'ready' });
  assert.deepEqual(persistence.loadClientFormDraft(storage, scope, 2_000), { kind: 'ready', value: draft });

  for (const otherScope of [
    { ...scope, userId: '44444444-4444-4444-8444-444444444444' },
    { ...scope, organizationId: '55555555-5555-4555-8555-555555555555' },
    { ...scope, formContext: 'edit:66666666-6666-4666-8666-666666666666' },
  ]) {
    assert.deepEqual(persistence.loadClientFormDraft(storage, otherScope, 2_000), { kind: 'ready', value: null });
  }
});

test('draft expires after 24 hours and explicit discard removes it immediately', () => {
  const storage = memoryStorage();
  persistence.saveClientFormDraft(storage, scope, draft, 1_000);
  const key = persistence.clientFormDraftStorageKey(scope);
  assert.equal(storage.has(key), true);
  assert.deepEqual(
    persistence.loadClientFormDraft(storage, scope, 1_000 + persistence.CLIENT_FORM_STORAGE_TTL_MS + 1),
    { kind: 'ready', value: null },
  );
  assert.equal(storage.has(key), false);

  persistence.saveClientFormDraft(storage, scope, draft, 2_000);
  assert.deepEqual(persistence.clearClientFormDraft(storage, scope), { kind: 'ready' });
  assert.deepEqual(persistence.loadClientFormDraft(storage, scope, 2_001), { kind: 'ready', value: null });
});

test('certificate recovery preserves a request before start acknowledgement and isolates CRC jobs', () => {
  const storage = memoryStorage();
  const recovery = {
    requestId: '77777777-7777-4777-8777-777777777777',
    crcCode: '1234-5678-9012',
    startedAt: '2026-10-23T09:00:00+00:00',
    phase: 'QUEUED',
  };
  assert.deepEqual(persistence.saveCertificateRecovery(storage, scope, recovery, 1_000), { kind: 'ready' });
  assert.deepEqual(
    persistence.loadCertificateRecovery(storage, scope, '1234-5678-9012', 2_000),
    { kind: 'ready', value: recovery },
  );
  assert.deepEqual(
    persistence.loadCertificateRecovery(storage, scope, '9999-9999-9999', 2_000),
    { kind: 'ready', value: null },
  );
});

test('unavailable browser storage is reported instead of starting an unrecoverable lookup', () => {
  const storage = {
    getItem() { throw new DOMException('blocked', 'SecurityError'); },
    setItem() { throw new DOMException('blocked', 'SecurityError'); },
    removeItem() { throw new DOMException('blocked', 'SecurityError'); },
  };
  assert.equal(persistence.loadClientFormDraft(storage, scope, 1_000).kind, 'unavailable');
  assert.equal(persistence.saveCertificateRecovery(storage, scope, {
    requestId: '77777777-7777-4777-8777-777777777777',
    crcCode: '1234-5678-9012',
    startedAt: '2026-10-23T09:00:00+00:00',
    phase: 'QUEUED',
  }, 1_000).kind, 'unavailable');
});
