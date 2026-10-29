import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  EdpDispatchEdgeResponseSchema,
  EdpDocumentUploadResponseSchema,
  EdpSettingsResponseSchema,
  EdpSignedUrlResponseSchema,
  parseEdpDraftPayload,
  parseEdpSaleContext,
  parseEdpSavedDraft,
  type EdpChecklistRule,
  type EdpDispatchEdgeResponse,
  type EdpDocumentUploadResponse,
  type EdpDraftPayload,
  type EdpSaleContext,
  type EdpSavedDraft,
  type EdpSettings,
  type EdpSettingsResponse,
  type EdpSignedUrlResponse,
} from "@/lib/edp/validation";
import type { EdpDocumentSide } from "@/lib/edp/types";
import { invokeFunction } from "@/lib/invokeFunction";
import { toEdpApiError } from "./api-errors";

export type EdpDocumentUploadInput = {
  readonly clientId: string;
  /** Documento existente: o ficheiro entra como nova versão em vez de criar outro documento. */
  readonly documentId?: string;
  readonly personId: string | null;
  readonly category: string;
  readonly label: string;
  readonly side: EdpDocumentSide;
  readonly validityConfirmedOn: string | null;
  readonly file: File;
};

export async function getEdpSaleContext(saleId: string): Promise<EdpSaleContext> {
  const { data, error } = await supabase.rpc("edp_get_sale_context", { p_sale_id: saleId });
  if (error) throw toEdpApiError(error);
  return parseEdpSaleContext(data);
}

export async function saveEdpDraft(
  saleId: string,
  expectedRevision: number,
  payload: EdpDraftPayload,
): Promise<EdpSavedDraft> {
  const parsed = parseEdpDraftPayload(payload);
  const { data, error } = await supabase.rpc("edp_save_draft", {
    p_sale_id: saleId,
    p_expected_revision: expectedRevision,
    p_payload: draftPayloadToJson(parsed),
  });
  if (error) throw toEdpApiError(error);
  return parseEdpSavedDraft(data);
}

export async function getEdpSettings(): Promise<EdpSettingsResponse> {
  const { data, error } = await supabase.rpc("edp_get_settings", {});
  if (error) throw toEdpApiError(error);
  return EdpSettingsResponseSchema.parse(data);
}

export async function saveEdpSettings(
  expectedRevision: number,
  settings: EdpSettings,
  checklist: readonly EdpChecklistRule[],
): Promise<EdpSettingsResponse> {
  const { data, error } = await supabase.rpc("edp_save_settings", {
    p_expected_revision: expectedRevision,
    p_settings: settingsToJson(settings),
    p_checklist: checklistToJson(checklist),
  });
  if (error) throw toEdpApiError(error);
  return EdpSettingsResponseSchema.parse(data);
}

export async function uploadEdpDocument(input: EdpDocumentUploadInput): Promise<EdpDocumentUploadResponse> {
  const body = new FormData();
  body.set("action", "upload");
  body.set("client_id", input.clientId);
  if (input.documentId) body.set("document_id", input.documentId);
  if (input.personId) body.set("person_id", input.personId);
  body.set("category", input.category);
  body.set("label", input.label);
  body.set("side", input.side);
  if (input.validityConfirmedOn) body.set("validity_confirmed_on", input.validityConfirmedOn);
  body.set("file", input.file);

  try {
    return EdpDocumentUploadResponseSchema.parse(await invokeFunction<unknown>("edp-documents", body));
  } catch (error) {
    throw toEdpApiError(error);
  }
}

export async function getEdpSignedUrl(versionId: string): Promise<EdpSignedUrlResponse> {
  try {
    const response = await invokeFunction<unknown>("edp-documents", { action: "signed_url", version_id: versionId });
    return EdpSignedUrlResponseSchema.parse(response);
  } catch (error) {
    throw toEdpApiError(error);
  }
}

export async function dispatchEdpSale(
  saleId: string,
  expectedRevision: number,
  idempotencyKey: string,
): Promise<EdpDispatchEdgeResponse> {
  try {
    const response = await invokeFunction<unknown>("edp-dispatch", {
      action: "send",
      sale_id: saleId,
      expected_revision: expectedRevision,
      idempotency_key: idempotencyKey,
    });
    return EdpDispatchEdgeResponseSchema.parse(response);
  } catch (error) {
    throw toEdpApiError(error);
  }
}

function draftPayloadToJson(payload: EdpDraftPayload): Json {
  return {
    energy_type: payload.energy_type,
    proposal_number: payload.proposal_number,
    supply_points: payload.supply_points.map((point) => ({ ...point })),
    responsible_person_id: payload.responsible_person_id,
    responsible: payload.responsible ? { ...payload.responsible } : null,
    confirm_client_contact_sync: payload.confirm_client_contact_sync,
    certificate_version_id: payload.certificate_version_id,
    direct_debit: payload.direct_debit,
    electronic_invoice: payload.electronic_invoice,
    billing_email: payload.billing_email,
    selected_document_version_ids: [...payload.selected_document_version_ids],
    checklist_confirmations: payload.checklist_confirmations.map((item) => ({ ...item })),
    paid_extraction_requested: false,
  };
}

function settingsToJson(settings: EdpSettings): Json {
  return {
    subject_template: settings.subject_template,
    body_template: settings.body_template,
    to: [...settings.to],
    cc: [...settings.cc],
    sender_name: settings.sender_name,
    sender_email: settings.sender_email,
    send_enabled: settings.send_enabled,
    transport: settings.transport,
  };
}

function checklistToJson(checklist: readonly EdpChecklistRule[]): Json {
  return checklist.map((rule) => ({
    id: rule.id,
    energy_type: rule.energy_type,
    category: rule.category,
    label: rule.label,
    required: rule.required,
    position: rule.position,
  }));
}
