import assert from "node:assert/strict";
import test from "node:test";

import type { EdpDraftPayload, EdpPersonRole } from "../../lib/edp/validation.ts";
import {
  getUniqueDecisionMakers,
  setChecklistConfirmation,
  toggleDocumentVersion,
  updateSupplyPoint,
} from "./payload.ts";

const person = (personId: string, role: EdpPersonRole["role"]): EdpPersonRole => ({
  person_id: personId,
  organization_id: "11111111-1111-4111-8111-111111111111",
  client_id: "22222222-2222-4222-8222-222222222222",
  name: `Pessoa ${personId}`,
  nif: null,
  phone: "+351910000000",
  email: "pessoa@example.test",
  person_source: "manual",
  source_ref: null,
  source_metadata: {},
  role,
  role_source: "manual",
  is_complete: true,
  created_at: "2026-10-28T00:00:00Z",
  updated_at: "2026-10-28T00:00:00Z",
});

const payload: EdpDraftPayload = {
  energy_type: "ee_gn",
  proposal_number: "PROP-001",
  supply_points: [
    { kind: "cpe", code: "PT-CPE", contract_start_date: "2026-11-01" },
    { kind: "cui", code: "PT-CUI", contract_start_date: null },
  ],
  responsible_person_id: null,
  responsible: null,
  confirm_client_contact_sync: false,
  certificate_version_id: null,
  direct_debit: null,
  electronic_invoice: null,
  billing_email: null,
  selected_document_version_ids: ["11111111-1111-4111-8111-111111111111"],
  checklist_confirmations: [
    { rule_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", confirmed: false },
  ],
  paid_extraction_requested: false,
};

test("editing one supply point preserves every other CPE and CUI", () => {
  const updated = updateSupplyPoint(payload, 1, { contract_start_date: "2026-12-15" });

  assert.equal(updated.supply_points.length, 2);
  assert.deepEqual(updated.supply_points[0], payload.supply_points[0]);
  assert.deepEqual(updated.supply_points[1], {
    kind: "cui",
    code: "PT-CUI",
    contract_start_date: "2026-12-15",
  });
});

test("document selection adds once and removes only the chosen version", () => {
  const secondVersion = "22222222-2222-4222-8222-222222222222";
  const added = toggleDocumentVersion(payload, secondVersion, true);
  const addedAgain = toggleDocumentVersion(added, secondVersion, true);
  const removed = toggleDocumentVersion(addedAgain, secondVersion, false);

  assert.deepEqual(addedAgain.selected_document_version_ids, [
    "11111111-1111-4111-8111-111111111111",
    secondVersion,
  ]);
  assert.deepEqual(removed.selected_document_version_ids, [
    "11111111-1111-4111-8111-111111111111",
  ]);
});

test("confirming one checklist rule preserves other confirmations", () => {
  const secondRule = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const withSecond = setChecklistConfirmation(payload, secondRule, true);
  const updatedFirst = setChecklistConfirmation(
    withSecond,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    true,
  );

  assert.deepEqual(updatedFirst.checklist_confirmations, [
    { rule_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", confirmed: true },
    { rule_id: secondRule, confirmed: true },
  ]);
});

test("responsible candidates include unique decision makers but never legal-only people", () => {
  const sharedId = "33333333-3333-4333-8333-333333333333";
  const decisionMakerId = "44444444-4444-4444-8444-444444444444";
  const candidates = getUniqueDecisionMakers([
    person(sharedId, "legal_manager"),
    person(sharedId, "decision_maker"),
    person(sharedId, "decision_maker"),
    person(decisionMakerId, "decision_maker"),
    person("55555555-5555-4555-8555-555555555555", "shareholder"),
  ]);

  assert.deepEqual(candidates.map((candidate) => candidate.person_id), [sharedId, decisionMakerId]);
});
