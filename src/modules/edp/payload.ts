import type {
  EdpDraftPayload,
  EdpPersonRole,
  EdpSupplyPointSchema,
} from "../../lib/edp/validation.ts";
import type { z } from "zod";

type EdpSupplyPoint = z.infer<typeof EdpSupplyPointSchema>;

export function getUniqueDecisionMakers(people: readonly EdpPersonRole[]): readonly EdpPersonRole[] {
  const byId = new Map<string, EdpPersonRole>();

  for (const person of people) {
    if (person.role === "decision_maker" && !byId.has(person.person_id)) {
      byId.set(person.person_id, person);
    }
  }

  return [...byId.values()];
}

export function updateSupplyPoint(
  payload: EdpDraftPayload,
  index: number,
  patch: Partial<EdpSupplyPoint>,
): EdpDraftPayload {
  return {
    ...payload,
    supply_points: payload.supply_points.map((point, pointIndex) =>
      pointIndex === index ? { ...point, ...patch } : point,
    ),
  };
}

export function toggleDocumentVersion(
  payload: EdpDraftPayload,
  versionId: string,
  selected: boolean,
): EdpDraftPayload {
  const versionIds = selected
    ? payload.selected_document_version_ids.includes(versionId)
      ? payload.selected_document_version_ids
      : [...payload.selected_document_version_ids, versionId]
    : payload.selected_document_version_ids.filter((id) => id !== versionId);

  return { ...payload, selected_document_version_ids: versionIds };
}

export function setChecklistConfirmation(
  payload: EdpDraftPayload,
  ruleId: string,
  confirmed: boolean,
): EdpDraftPayload {
  const existing = payload.checklist_confirmations.some((item) => item.rule_id === ruleId);
  const confirmations = existing
    ? payload.checklist_confirmations.map((item) =>
      item.rule_id === ruleId ? { ...item, confirmed } : item,
    )
    : [...payload.checklist_confirmations, { rule_id: ruleId, confirmed }];

  return { ...payload, checklist_confirmations: confirmations };
}
