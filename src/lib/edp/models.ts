import type { EdpDispatchState, EdpDocumentSide, EdpEnergyType, EdpPersonRole as PersonRole, EdpPersonSource, EdpPointKind, EdpReadiness } from './types';

export type EdpSupplyPoint = {
  readonly kind: EdpPointKind;
  readonly code: string;
  readonly contract_start_date: string | null;
};

export type EdpResponsible = {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
};

export type EdpDraftPayload = {
  readonly energy_type: EdpEnergyType;
  readonly proposal_number: string;
  readonly supply_points: EdpSupplyPoint[];
  readonly responsible_person_id: string | null;
  readonly responsible: EdpResponsible | null;
  readonly confirm_client_contact_sync: boolean;
  readonly certificate_version_id: string | null;
  readonly direct_debit: boolean | null;
  readonly electronic_invoice: boolean | null;
  readonly billing_email: string | null;
  readonly selected_document_version_ids: string[];
  readonly checklist_confirmations: { readonly rule_id: string; readonly confirmed: boolean }[];
  readonly paid_extraction_requested: false;
};

export type EdpPersonRole = {
  readonly person_id: string;
  readonly organization_id: string;
  readonly client_id: string;
  readonly name: string;
  readonly nif: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly person_source: EdpPersonSource;
  readonly source_ref: string | null;
  readonly source_metadata: Readonly<Record<string, unknown>>;
  readonly role: PersonRole;
  readonly role_source: EdpPersonSource;
  readonly is_complete: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type EdpCertificateHistory = {
  readonly version_id: string;
  readonly organization_id: string;
  readonly client_id: string;
  readonly crc_code: string | null;
  readonly certificate_data: Readonly<Record<string, unknown>>;
  readonly valid_from: string | null;
  readonly valid_until: string | null;
  readonly source: 'legacy' | 'manual' | 'crc_lookup';
  readonly source_metadata: Readonly<Record<string, unknown>>;
  readonly recorded_by: string | null;
  readonly recorded_at: string;
  readonly is_current: boolean;
};

export type EdpDocumentVersion = {
  readonly document_id: string;
  readonly version_id: string;
  readonly person_id: string | null;
  readonly category: string;
  readonly label: string;
  readonly side: EdpDocumentSide;
  readonly original_name: string;
  readonly mime_type: 'application/pdf' | 'image/jpeg' | 'image/png';
  readonly size_bytes: number;
  readonly sha256: string;
  readonly validity_suggested_on: string | null;
  readonly validity_confirmed_on: string | null;
  readonly created_at: string;
};

export type EdpChecklistRule = {
  readonly id: string;
  readonly energy_type: EdpEnergyType;
  readonly category: string;
  readonly label: string;
  readonly required: boolean;
  readonly position: number;
};

export type EdpSettings = {
  readonly revision: number;
  readonly subject_template: string;
  readonly body_template: string;
  readonly to: string[];
  readonly cc: string[];
  readonly sender_name: string;
  readonly sender_email: string;
  readonly send_enabled: boolean;
  readonly transport: 'local_capture' | 'brevo';
  readonly officially_confirmed: false;
  readonly configured: boolean;
};

export type EdpAttachmentManifestItem = {
  readonly version_id: string;
  readonly document_id: string;
  readonly bucket_id: 'edp-client-documents';
  readonly storage_path: string;
  readonly filename: string;
  readonly mime_type: 'application/pdf' | 'image/jpeg' | 'image/png';
  readonly size_bytes: number;
  readonly sha256: string;
};

export type EdpDispatchSnapshot = {
  readonly schema_version: 1;
  readonly sale: { readonly id: string; readonly organization_id: string; readonly client_id: string; readonly proposal_number: string; readonly energy_type: EdpEnergyType; readonly negotiation_type: string | null; readonly supply_points: EdpSupplyPoint[] };
  readonly client: { readonly id: string; readonly name: string; readonly nif: string | null };
  readonly responsible: EdpResponsible & { readonly person_id: string };
  readonly certificate: { readonly version_id: string; readonly crc_code: string | null; readonly valid_until: string; readonly source: 'legacy' | 'manual' | 'crc_lookup' };
  readonly preferences: { readonly direct_debit: boolean; readonly electronic_invoice: boolean; readonly billing_email: string | null };
  readonly delivery: { readonly to: string[]; readonly cc: string[]; readonly sender_name: string; readonly sender_email: string; readonly transport: 'local_capture' | 'brevo'; readonly subject: string; readonly html: string };
  readonly checklist: { readonly rule_id: string; readonly category: string; readonly label: string; readonly required: boolean; readonly confirmed: boolean }[];
  readonly attachments: EdpAttachmentManifestItem[];
  readonly draft_revision: number;
  readonly created_at: string;
};

export type EdpDispatchHistory = {
  readonly dispatch_id: string;
  readonly sale_id: string;
  readonly state: EdpDispatchState;
  readonly snapshot: EdpDispatchSnapshot;
  readonly attachment_manifest: EdpAttachmentManifestItem[];
  readonly email_send_id: string | null;
  readonly created_by: string;
  readonly created_by_name: string | null;
  readonly created_at: string;
  readonly accepted_at: string | null;
};

export type EdpSavedDraft = {
  readonly sale_id: string;
  readonly revision: number;
  readonly payload: EdpDraftPayload;
  readonly readiness: EdpReadiness;
  readonly blocking_reasons: string[];
  readonly updated_at: string;
};

export type EdpReserveDispatchResponse = {
  readonly dispatch_id: string;
  readonly attempt_id: string;
  readonly state: EdpDispatchState;
  readonly same_request: boolean;
  readonly snapshot: EdpDispatchSnapshot;
  readonly attachment_manifest: EdpAttachmentManifestItem[];
};

export type EdpDispatchEdgeResponse = EdpReserveDispatchResponse & { readonly message_id: string | null };
export type EdpDocumentUploadResponse = EdpDocumentVersion;
export type EdpSignedUrlResponse = { readonly url: string; readonly expires_in: 60 };
export type EdpArchiveDocumentResponse = { readonly document_id: string; readonly archived_at: string };
export type EdpSettingsResponse = { readonly settings: EdpSettings; readonly checklist: EdpChecklistRule[] };

export type EdpSaleContext = {
  readonly sale: { readonly id: string; readonly organization_id: string; readonly client_id: string; readonly proposal_id: string | null; readonly proposal_type: string | null; readonly negotiation_type: string | null; readonly edp_proposal_number: string | null; readonly created_by: string | null };
  readonly client: { readonly id: string; readonly name: string; readonly nif: string | null; readonly assigned_to: string | null };
  readonly people: EdpPersonRole[];
  readonly certificate_history: EdpCertificateHistory[];
  readonly documents: EdpDocumentVersion[];
  readonly settings: EdpSettings;
  readonly checklist: EdpChecklistRule[];
  readonly suggested_payload: EdpDraftPayload;
  readonly draft: EdpSavedDraft | null;
  readonly history: EdpDispatchHistory[];
};
