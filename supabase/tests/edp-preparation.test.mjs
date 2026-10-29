import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function loadTypeScript(path, mocks = {}) {
  const exports = {};
  const source = fs.readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function('require', 'exports', output)((name) => mocks[name] ?? require(name), exports);
  return exports;
}

const types = loadTypeScript('src/lib/edp/types.ts');
const validation = loadTypeScript('src/lib/edp/validation.ts', { './types': types });
const template = loadTypeScript('src/lib/edp/template.ts');

const draft = {
  energy_type: 'ee_gn',
  proposal_number: 'SF-2026-001',
  supply_points: [
    { kind: 'cpe', code: 'PT0002000000000000000000AB', contract_start_date: '2026-11-01' },
    { kind: 'cui', code: 'PT1600000000000000000000', contract_start_date: '2026-12-01' },
  ],
  responsible_person_id: '11111111-1111-4111-8111-111111111111',
  responsible: { name: 'Ana Silva', phone: '910000000', email: 'ana@example.test' },
  confirm_client_contact_sync: false,
  certificate_version_id: '22222222-2222-4222-8222-222222222222',
  direct_debit: true,
  electronic_invoice: true,
  billing_email: 'faturacao@example.test',
  selected_document_version_ids: ['33333333-3333-4333-8333-333333333333'],
  checklist_confirmations: [{ rule_id: '44444444-4444-4444-8444-444444444444', confirmed: true }],
  paid_extraction_requested: false,
};

const readinessContext = {
  now: '2026-10-28',
  certificate: { id: draft.certificate_version_id, valid_until: '2027-10-28', is_current: true },
  decision_maker_complete: true,
  available_document_version_ids: draft.selected_document_version_ids,
  required_checklist_rule_ids: ['44444444-4444-4444-8444-444444444444'],
  settings_configured: true,
};

test('draft parser preserves every supply point and its explicit contract date', () => {
  const parsed = validation.parseEdpDraftPayload(draft);
  assert.deepEqual(parsed.supply_points, draft.supply_points);
  assert.equal(parsed.proposal_number, 'SF-2026-001');
});

test('draft parser rejects paid extraction and preserves an incomplete point for later review', () => {
  assert.throws(
    () => validation.parseEdpDraftPayload({ ...draft, paid_extraction_requested: true }),
    /paid_extraction_requested/,
  );
  const incomplete = validation.parseEdpDraftPayload({
    ...draft,
    supply_points: [{ kind: 'cpe', code: 'PT0002', contract_start_date: null }],
  });
  assert.equal(incomplete.supply_points[0].contract_start_date, null);
  assert.deepEqual(
    validation.evaluateEdpReadiness(incomplete, readinessContext).blocking_reasons,
    ['contract_start_date_missing'],
  );
});

test('draft parser preserves an incomplete responsible contact while readiness blocks it', () => {
  const incomplete = validation.parseEdpDraftPayload({
    ...draft,
    responsible: { name: 'Ana', phone: '', email: 'ana@' },
  });
  assert.deepEqual(incomplete.responsible, { name: 'Ana', phone: '', email: 'ana@' });
  assert.deepEqual(
    validation.evaluateEdpReadiness(incomplete, readinessContext).blocking_reasons,
    ['decision_maker_incomplete'],
  );
});

test('readiness requires billing email only when electronic invoice is enabled', () => {
  const blocked = validation.evaluateEdpReadiness({ ...draft, billing_email: null }, readinessContext);
  assert.equal(blocked.readiness, 'blocked');
  assert.deepEqual(blocked.blocking_reasons, ['billing_email_required']);

  const ready = validation.evaluateEdpReadiness(
    { ...draft, electronic_invoice: false, billing_email: null },
    readinessContext,
  );
  assert.deepEqual(ready, { readiness: 'ready', blocking_reasons: [] });
});

test('readiness blocks unknown or expired CRC and missing selected versions', () => {
  const unknown = validation.evaluateEdpReadiness(draft, { ...readinessContext, certificate: null });
  assert.deepEqual(unknown.blocking_reasons, ['certificate_missing']);

  const expired = validation.evaluateEdpReadiness(draft, {
    ...readinessContext,
    certificate: { ...readinessContext.certificate, valid_until: '2026-10-27' },
  });
  assert.deepEqual(expired.blocking_reasons, ['certificate_expired']);

  const missingDocument = validation.evaluateEdpReadiness(draft, {
    ...readinessContext,
    available_document_version_ids: [],
  });
  assert.deepEqual(missingDocument.blocking_reasons, ['selected_document_missing']);
});

test('template rendering escapes values and refuses unknown placeholders', () => {
  const rendered = template.renderEdpTemplate(
    '<p>Cliente: {{client_name}}</p><p>Proposta: {{proposal_number}}</p>',
    { client_name: '<img src=x onerror=alert(1)>', proposal_number: 'SF&1' },
    'html',
  );
  assert.equal(
    rendered,
    '<p>Cliente: &lt;img src=x onerror=alert(1)&gt;</p><p>Proposta: SF&amp;1</p>',
  );
  assert.throws(
    () => template.renderEdpTemplate('Olá {{missing}}', { client_name: 'Ana' }, 'text'),
    /missing/,
  );
});

test('subject rendering strips header injection', () => {
  assert.equal(
    template.renderEdpSubject('EDP {{proposal_number}}', { proposal_number: 'SF-1\r\nBcc: leak@example.test' }),
    'EDP SF-1 Bcc: leak@example.test',
  );
});

test('dispatch history preserves a human-readable author beside the immutable snapshot', () => {
  const parsed = validation.EdpDispatchHistorySchema.parse({
    dispatch_id: '70000000-0000-4000-8000-000000000001',
    sale_id: '40000000-0000-4000-8000-000000000001',
    state: 'accepted',
    snapshot: {
      schema_version: 1,
      sale: { id: '40000000-0000-4000-8000-000000000001', organization_id: '10000000-0000-4000-8000-000000000001', client_id: '30000000-0000-4000-8000-000000000001', proposal_number: 'SF-1', energy_type: 'ee', negotiation_type: null, supply_points: [] },
      client: { id: '30000000-0000-4000-8000-000000000001', name: 'Cliente', nif: null },
      responsible: { person_id: '11111111-1111-4111-8111-111111111111', name: 'Ana', phone: '910000000', email: 'ana@example.test' },
      certificate: { version_id: '22222222-2222-4222-8222-222222222222', crc_code: null, valid_until: '2027-10-28', source: 'manual' },
      preferences: { direct_debit: true, electronic_invoice: false, billing_email: null },
      delivery: { to: ['edp@example.test'], cc: [], sender_name: 'P2G', sender_email: 'local@example.test', transport: 'local_capture', subject: 'EDP', html: '<p>EDP</p>' },
      checklist: [], attachments: [], draft_revision: 1, created_at: '2026-10-28T12:00:00Z',
    },
    attachment_manifest: [], email_send_id: null,
    created_by: '20000000-0000-4000-8000-000000000001', created_by_name: 'Ana Operadora',
    created_at: '2026-10-28T12:00:00Z', accepted_at: '2026-10-28T12:00:01Z',
  });
  assert.equal(parsed.created_by_name, 'Ana Operadora');
});
