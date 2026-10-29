import assert from "node:assert/strict";
import test from "node:test";

import type { EdpDraftPayload, EdpSavedDraft } from "../../lib/edp/validation.ts";
import type { EdpDraftSource } from "./draft-state.ts";
import { createEdpDraftState, edpDraftReducer } from "./draft-state.ts";

const suggestedPayload: EdpDraftPayload = {
  energy_type: "ee",
  proposal_number: "PROP-SUGERIDA",
  supply_points: [{ kind: "cpe", code: "PT0001", contract_start_date: null }],
  responsible_person_id: null,
  responsible: null,
  confirm_client_contact_sync: false,
  certificate_version_id: null,
  direct_debit: null,
  electronic_invoice: null,
  billing_email: null,
  selected_document_version_ids: [],
  checklist_confirmations: [],
  paid_extraction_requested: false,
};

const savedPayload: EdpDraftPayload = {
  ...suggestedPayload,
  proposal_number: "PROP-GUARDADA",
  supply_points: [{ kind: "cpe", code: "PT0001", contract_start_date: "2026-11-01" }],
};

const savedDraft: EdpSavedDraft = {
  sale_id: "sale-1",
  revision: 3,
  payload: savedPayload,
  readiness: "ready",
  blocking_reasons: [],
  updated_at: "2026-10-28T10:00:00Z",
};

test("an existing server draft wins over suggested sale data", () => {
  const source: EdpDraftSource = { suggested_payload: suggestedPayload, draft: savedDraft };

  const state = createEdpDraftState(source);

  assert.equal(state.revision, 3);
  assert.equal(state.payload.proposal_number, "PROP-GUARDADA");
  assert.equal(state.readiness, "ready");
  assert.equal(state.dirty, false);
});

test("a sale without a draft starts at revision zero with every suggested point", () => {
  const source: EdpDraftSource = { suggested_payload: suggestedPayload, draft: null };

  const state = createEdpDraftState(source);

  assert.equal(state.revision, 0);
  assert.deepEqual(state.payload.supply_points, suggestedPayload.supply_points);
  assert.equal(state.readiness, "draft");
});

test("save failure retains the local draft and revision", () => {
  const edited = edpDraftReducer(createEdpDraftState({ suggested_payload: suggestedPayload, draft: null }), {
    type: "edit",
    payload: savedPayload,
  });

  const failed = edpDraftReducer(edited, { type: "save_failed" });

  assert.equal(failed.payload.proposal_number, "PROP-GUARDADA");
  assert.equal(failed.revision, 0);
  assert.equal(failed.dirty, true);
});

test("revision conflict keeps local edits visible until the user reviews them", () => {
  const edited = edpDraftReducer(createEdpDraftState({ suggested_payload: suggestedPayload, draft: null }), {
    type: "edit",
    payload: savedPayload,
  });

  const conflicted = edpDraftReducer(edited, { type: "revision_conflict" });

  assert.equal(conflicted.payload.proposal_number, "PROP-GUARDADA");
  assert.equal(conflicted.hasConflict, true);
  assert.equal(conflicted.dirty, true);
});

test("successful save adopts the server revision and clears dirty state", () => {
  const edited = edpDraftReducer(createEdpDraftState({ suggested_payload: suggestedPayload, draft: null }), {
    type: "edit",
    payload: savedPayload,
  });

  const saved = edpDraftReducer(edited, { type: "save_succeeded", draft: savedDraft });

  assert.equal(saved.revision, 3);
  assert.equal(saved.readiness, "ready");
  assert.equal(saved.dirty, false);
  assert.equal(saved.hasConflict, false);
});

test("reviewing a revision conflict keeps local edits and rebases only the revision", () => {
  const edited = edpDraftReducer(createEdpDraftState({ suggested_payload: suggestedPayload, draft: null }), {
    type: "edit",
    payload: savedPayload,
  });
  const conflicted = edpDraftReducer(edited, { type: "revision_conflict" });

  const reviewed = edpDraftReducer(conflicted, { type: "rebase_revision", revision: 7 });

  assert.equal(reviewed.revision, 7);
  assert.equal(reviewed.payload.proposal_number, "PROP-GUARDADA");
  assert.equal(reviewed.dirty, true);
  assert.equal(reviewed.hasConflict, false);
});
