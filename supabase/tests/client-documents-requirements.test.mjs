// Azores is UTC-1 in winter: date-only values must not shift to the previous day.
process.env.TZ = 'Atlantic/Azores';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function load(path) {
  const moduleExports = {};
  const compiled = ts.transpile(readFileSync(path, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  new Function('require', 'exports', compiled)(require, moduleExports);
  return moduleExports;
}

const { summarizeClientDocumentRequirement, clientDocumentDateStatus, prepareClientDocumentUploadMetadata } = load('src/lib/client-documents.ts');
const { isEdpWorkflowActor } = load('src/lib/edp-permissions.ts');
const { formatDate } = load('src/lib/format.ts');

const today = '2026-10-29';
const personA = '00000000-0000-4000-8000-0000000000a1';
const personB = '00000000-0000-4000-8000-0000000000b1';
let sequence = 0;

function version(side, createdAt, { suggested = null, confirmed = null } = {}) {
  sequence += 1;
  return {
    version_id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    side, original_name: `file-${sequence}.pdf`, mime_type: 'application/pdf', size_bytes: 10, sha256: 'a'.repeat(64),
    validity_suggested_on: suggested, validity_confirmed_on: confirmed, created_at: createdAt,
  };
}

function documentItem(category, versions, { personId = null, archivedAt = null } = {}) {
  sequence += 1;
  const documentId = `00000000-0000-4000-9000-${String(sequence).padStart(12, '0')}`;
  return {
    documentId, clientId: '00000000-0000-4000-8000-0000000000c1', personId, personName: null, category, label: category,
    archivedAt, createdAt: versions.at(-1)?.created_at ?? '2026-01-01T00:00:00Z',
    versions: versions
      .map((item) => ({ ...item, document_id: documentId, person_id: personId, category, label: category }))
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
  };
}

const summarize = (category, documents) => summarizeClientDocumentRequirement(category, documents, today);

test('a requirement without active documents is missing; archived documents do not count', () => {
  const archived = documentItem('Fatura', [version('single', '2026-05-01T10:00:00Z', { confirmed: '2027-01-01' })], { archivedAt: '2026-06-01T00:00:00Z' });
  assert.equal(summarize('Fatura', []).status, 'missing');
  assert.equal(summarize('Fatura', [archived]).status, 'missing');
});

test('a CC uploaded front and back together is complete and uses its validity', () => {
  const cc = documentItem('CC', [version('single', '2026-05-01T10:00:00Z', { suggested: '2030-03-01' })], { personId: personA });
  const result = summarize('CC', [cc]);
  assert.equal(result.status, 'valid');
  assert.equal(result.missingSide, null);
  assert.equal(result.validUntil, '2030-03-01');
});

test('a CC with only the front is partial and asks for the back', () => {
  const cc = documentItem('CC', [version('front', '2026-05-01T10:00:00Z', { suggested: '2030-03-01' })], { personId: personA });
  const result = summarize('CC', [cc]);
  assert.equal(result.status, 'partial');
  assert.equal(result.missingSide, 'back');
});

test('a new CC front does not reuse the back of an older card uploaded as a single file', () => {
  const cc = documentItem('CC', [
    version('single', '2024-01-01T10:00:00Z', { suggested: '2025-01-01' }),
    version('front', '2026-05-01T10:00:00Z', { suggested: '2031-01-01' }),
  ], { personId: personA });
  const result = summarize('CC', [cc]);
  assert.equal(result.status, 'partial');
  assert.equal(result.missingSide, 'back');
});

test('the front of one person and the back of another do not make a complete CC', () => {
  const front = documentItem('CC', [version('front', '2026-05-01T10:00:00Z')], { personId: personA });
  const back = documentItem('CC', [version('back', '2026-05-02T10:00:00Z')], { personId: personB });
  const result = summarize('CC', [front, back]);
  assert.equal(result.status, 'partial');
  assert.equal(result.missingSide, 'front');
});

test('CC validity comes from the front when the newer back has no date', () => {
  const cc = documentItem('CC', [
    version('front', '2026-05-01T10:00:00Z', { suggested: '2029-05-01' }),
    version('back', '2026-05-02T10:00:00Z'),
  ], { personId: personA });
  const result = summarize('CC', [cc]);
  assert.equal(result.status, 'valid');
  assert.equal(result.validUntil, '2029-05-01');
});

test('an invoice ignores the suggested date (usually the payment deadline) and uses only the confirmed one', () => {
  const suggestedOnly = documentItem('Fatura', [version('single', '2026-10-01T10:00:00Z', { suggested: '2026-10-15' })]);
  assert.equal(summarize('Fatura', [suggestedOnly]).status, 'unknown');
  const confirmed = documentItem('Fatura', [version('single', '2026-10-01T10:00:00Z', { suggested: '2026-10-15', confirmed: '2027-06-01' })]);
  assert.equal(summarize('Fatura', [confirmed]).status, 'valid');
});

test('the certificate trusts the suggested validity date', () => {
  const crc = documentItem('CRC', [version('single', '2026-10-01T10:00:00Z', { suggested: '2026-11-10' })]);
  const result = summarize('CRC', [crc]);
  assert.equal(result.status, 'expiring');
  assert.equal(result.validUntil, '2026-11-10');
});

test('date status: past is expired, today and the next 30 days are expiring, later is valid', () => {
  assert.equal(clientDocumentDateStatus('2026-10-28', today), 'expired');
  assert.equal(clientDocumentDateStatus('2026-10-29', today), 'expiring');
  assert.equal(clientDocumentDateStatus('2026-11-28', today), 'expiring');
  assert.equal(clientDocumentDateStatus('2026-11-29', today), 'valid');
  assert.equal(clientDocumentDateStatus(null, today), 'unknown');
});

test('upload labels are capped at the 200 characters the server accepts', () => {
  const metadata = prepareClientDocumentUploadMetadata({ category: 'Outro', customLabel: '', fileName: `${'x'.repeat(250)}.pdf`, side: 'front' });
  assert.equal(metadata.label.length, 200);
  assert.equal(metadata.side, 'single');
});

test('date-only values keep their day in negative UTC offsets', () => {
  assert.equal(new Date('2027-03-01').getDate(), 28, 'sanity: the native parser shifts the day in this time zone');
  assert.equal(formatDate('2027-03-01'), '01/03/2027');
});

test('document management mirrors the server rule edp_is_workflow_actor', () => {
  const member = (overrides) => ({ memberRole: 'viewer', memberActive: true, hasProfile: true, profileName: 'Comercial', baseRole: 'manager', ...overrides });
  assert.equal(isEdpWorkflowActor(true, null), true, 'global admin');
  assert.equal(isEdpWorkflowActor(false, null), false, 'no membership');
  assert.equal(isEdpWorkflowActor(false, member({ profileName: 'Back Office' })), true, 'Back Office profile');
  assert.equal(isEdpWorkflowActor(false, member({ baseRole: 'salesperson' })), true, 'salesperson base role');
  assert.equal(isEdpWorkflowActor(false, member({ baseRole: 'admin' })), true, 'admin base role');
  assert.equal(isEdpWorkflowActor(false, member({})), false, 'other profile');
  assert.equal(isEdpWorkflowActor(false, member({ memberRole: 'admin' })), false, 'member role ignored when a profile is assigned');
  assert.equal(isEdpWorkflowActor(false, member({ hasProfile: false, profileName: null, baseRole: null, memberRole: 'salesperson' })), true, 'no profile, salesperson member');
  assert.equal(isEdpWorkflowActor(false, member({ hasProfile: false, profileName: null, baseRole: null, memberRole: 'viewer' })), false, 'no profile, viewer member');
  assert.equal(isEdpWorkflowActor(false, member({ profileName: 'Back Office', memberActive: false })), false, 'inactive member');
});
