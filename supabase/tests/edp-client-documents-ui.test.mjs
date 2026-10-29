import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadClientDocuments() {
  const moduleExports = {};
  const source = readFileSync('src/lib/client-documents.ts', 'utf8');
  const compiled = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  });
  new Function('require', 'exports', compiled)(require, moduleExports);
  return moduleExports;
}

const activeDocumentId = '00000000-0000-4000-8000-000000000501';
const archivedDocumentId = '00000000-0000-4000-8000-000000000502';
const personId = '00000000-0000-4000-8000-000000000503';

const documentRows = [{
  id: activeDocumentId,
  client_id: '00000000-0000-4000-8000-000000000504',
  person_id: personId,
  category: 'identificação',
  label: 'Cartão de cidadão',
  archived_at: null,
  created_at: '2026-10-27T09:00:00Z',
}, {
  id: archivedDocumentId,
  client_id: '00000000-0000-4000-8000-000000000504',
  person_id: null,
  category: 'contrato',
  label: 'Contrato antigo',
  archived_at: '2026-10-28T09:00:00Z',
  created_at: '2026-10-28T08:00:00Z',
}];

const versionRows = [{
  id: '00000000-0000-4000-8000-000000000505',
  document_id: activeDocumentId,
  side: 'front',
  original_name: 'cc-frente.png',
  mime_type: 'image/png',
  size_bytes: 1024,
  sha256: 'a'.repeat(64),
  validity_suggested_on: '2030-05-04',
  validity_confirmed_on: null,
  created_at: '2026-10-27T10:00:00Z',
}, {
  id: '00000000-0000-4000-8000-000000000506',
  document_id: activeDocumentId,
  side: 'back',
  original_name: 'cc-verso.png',
  mime_type: 'image/png',
  size_bytes: 2048,
  sha256: 'b'.repeat(64),
  validity_suggested_on: '2030-05-04',
  validity_confirmed_on: '2030-05-05',
  created_at: '2026-10-27T11:00:00Z',
}, {
  id: '00000000-0000-4000-8000-000000000507',
  document_id: archivedDocumentId,
  side: 'single',
  original_name: 'contrato.pdf',
  mime_type: 'application/pdf',
  size_bytes: 4096,
  sha256: 'c'.repeat(64),
  validity_suggested_on: null,
  validity_confirmed_on: null,
  created_at: '2026-10-28T08:00:00Z',
}];

test('client archive groups every version by document while preserving person, archive and validity facts', () => {
  const documents = loadClientDocuments();
  assert.deepEqual(documents.parseClientDocumentPeople([{ id: personId, name: 'Ana Decisora' }]), [
    { id: personId, name: 'Ana Decisora' },
  ]);
  const archive = documents.parseClientDocumentArchive(
    documentRows,
    versionRows,
    [{ id: personId, name: 'Ana Decisora' }],
  );

  assert.equal(archive.length, 2);
  assert.equal(archive[0].documentId, activeDocumentId);
  assert.equal(archive[0].personName, 'Ana Decisora');
  assert.equal(archive[0].archivedAt, null);
  assert.deepEqual(archive[0].versions.map((version) => version.version_id), [
    '00000000-0000-4000-8000-000000000506',
    '00000000-0000-4000-8000-000000000505',
  ]);
  assert.equal(archive[0].versions[0].category, 'identificação');
  assert.equal(archive[0].versions[0].validity_confirmed_on, '2030-05-05');
  assert.equal(archive[1].documentId, archivedDocumentId);
  assert.equal(archive[1].archivedAt, '2026-10-28T09:00:00Z');
});

test('document metadata distinguishes confirmed, suggested and unknown validity plus every supported side', () => {
  const documents = loadClientDocuments();

  assert.deepEqual(documents.clientDocumentValidity(versionRows[1]), { kind: 'confirmed', date: '2030-05-05' });
  assert.deepEqual(documents.clientDocumentValidity(versionRows[0]), { kind: 'suggested', date: '2030-05-04' });
  assert.deepEqual(documents.clientDocumentValidity(versionRows[2]), { kind: 'unknown', date: null });
  assert.equal(documents.clientDocumentSideLabel('single'), 'Documento único');
  assert.equal(documents.clientDocumentSideLabel('front'), 'Frente');
  assert.equal(documents.clientDocumentSideLabel('back'), 'Verso');
});

test('client archive rejects unexpected private storage fields and invalid document metadata at the query boundary', () => {
  const documents = loadClientDocuments();

  assert.throws(() => documents.parseClientDocumentArchive(
    [{ ...documentRows[0], organization_id: '00000000-0000-4000-8000-000000000508' }],
    versionRows,
    [{ id: personId, name: 'Ana Decisora' }],
  ));
  assert.throws(() => documents.parseClientDocumentArchive(
    documentRows,
    [{ ...versionRows[0], side: 'inside' }],
    [{ id: personId, name: 'Ana Decisora' }],
  ));
});

test('document upload metadata uses approved categories, optional names and CC-only faces', () => {
  const documents = loadClientDocuments();

  assert.deepEqual(documents.CLIENT_DOCUMENT_CATEGORY_OPTIONS.map(({ value }) => value), [
    'CC', 'Comprovativo de morada', 'CRC', 'Fatura', 'Outro',
  ]);
  assert.deepEqual(documents.prepareClientDocumentUploadMetadata({
    category: 'Comprovativo de morada', customLabel: '   ', fileName: 'morada.pdf', side: 'back',
  }), { category: 'Comprovativo de morada', label: 'morada.pdf', side: 'single' });
  assert.deepEqual(documents.prepareClientDocumentUploadMetadata({
    category: 'CC', customLabel: ' Cartão da Ana ', fileName: 'cc-verso.jpg', side: 'back',
  }), { category: 'CC', label: 'Cartão da Ana', side: 'back' });
});
