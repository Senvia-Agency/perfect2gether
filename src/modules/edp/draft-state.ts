import type { EdpDraftPayload, EdpSavedDraft } from "../../lib/edp/validation.ts";

export type EdpDraftSource = {
  readonly suggested_payload: EdpDraftPayload;
  readonly draft: EdpSavedDraft | null;
};

export type EdpDraftState = {
  readonly revision: number;
  readonly payload: EdpDraftPayload;
  readonly readiness: "draft" | "ready" | "blocked";
  readonly blockingReasons: readonly string[];
  readonly dirty: boolean;
  readonly hasConflict: boolean;
};

export type EdpDraftAction =
  | { readonly type: "edit"; readonly payload: EdpDraftPayload }
  | { readonly type: "save_failed" }
  | { readonly type: "revision_conflict" }
  | { readonly type: "rebase_revision"; readonly revision: number }
  | { readonly type: "save_succeeded"; readonly draft: EdpSavedDraft };

export function createEdpDraftState(source: EdpDraftSource): EdpDraftState {
  if (source.draft) {
    return {
      revision: source.draft.revision,
      payload: source.draft.payload,
      readiness: source.draft.readiness,
      blockingReasons: source.draft.blocking_reasons,
      dirty: false,
      hasConflict: false,
    };
  }

  return {
    revision: 0,
    payload: source.suggested_payload,
    readiness: "draft",
    blockingReasons: [],
    dirty: false,
    hasConflict: false,
  };
}

export function edpDraftReducer(state: EdpDraftState, action: EdpDraftAction): EdpDraftState {
  switch (action.type) {
    case "edit":
      return { ...state, payload: action.payload, dirty: true };
    case "save_failed":
      return state;
    case "revision_conflict":
      return { ...state, hasConflict: true };
    case "rebase_revision":
      return { ...state, revision: action.revision, hasConflict: false };
    case "save_succeeded":
      return {
        revision: action.draft.revision,
        payload: action.draft.payload,
        readiness: action.draft.readiness,
        blockingReasons: action.draft.blocking_reasons,
        dirty: false,
        hasConflict: false,
      };
    default:
      return assertNever(action);
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Ação de rascunho EDP inesperada: ${String(value)}`);
}
