import { z } from 'zod';
import {
  EDP_DISPATCH_STATES,
  EDP_DOCUMENT_SIDES,
  EDP_ENERGY_TYPES,
  EDP_PERSON_ROLES,
  EDP_PERSON_SOURCES,
  EDP_POINT_KINDS,
  EDP_READINESS,
  type EdpReadinessContext,
  type EdpReadinessResult,
} from './types';
import type {
  EdpArchiveDocumentResponse,
  EdpAttachmentManifestItem,
  EdpCertificateHistory,
  EdpChecklistRule,
  EdpDispatchEdgeResponse,
  EdpDispatchHistory,
  EdpDispatchSnapshot,
  EdpDocumentUploadResponse,
  EdpDocumentVersion,
  EdpDraftPayload,
  EdpPersonRole,
  EdpReserveDispatchResponse,
  EdpResponsible,
  EdpSaleContext,
  EdpSavedDraft,
  EdpSettings,
  EdpSettingsResponse,
  EdpSignedUrlResponse,
  EdpSupplyPoint,
} from './models';
export type {
  EdpArchiveDocumentResponse,
  EdpAttachmentManifestItem,
  EdpCertificateHistory,
  EdpChecklistRule,
  EdpDispatchEdgeResponse,
  EdpDispatchHistory,
  EdpDispatchSnapshot,
  EdpDocumentUploadResponse,
  EdpDocumentVersion,
  EdpDraftPayload,
  EdpPersonRole,
  EdpReserveDispatchResponse,
  EdpResponsible,
  EdpSaleContext,
  EdpSavedDraft,
  EdpSettings,
  EdpSettingsResponse,
  EdpSignedUrlResponse,
  EdpSupplyPoint,
} from './models';

const UuidSchema = z.string().uuid();
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const NullableDateSchema = DateSchema.nullable();
const EmailSchema = z.string().trim().email().max(320);
const validatedOutput = <T>() => z.custom<T>();

export const EdpSupplyPointSchema = z.object({
  kind: z.enum(EDP_POINT_KINDS),
  code: z.string().trim().min(1).max(80),
  contract_start_date: NullableDateSchema,
}).strict().pipe(validatedOutput<EdpSupplyPoint>());

export const EdpResponsibleSchema = z.object({
  name: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(320),
}).strict().pipe(validatedOutput<EdpResponsible>());

const EdpReadyResponsibleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(40),
  email: EmailSchema,
}).strict();

export const EdpDraftPayloadSchema = z.object({
  energy_type: z.enum(EDP_ENERGY_TYPES),
  proposal_number: z.string().trim().max(100),
  supply_points: z.array(EdpSupplyPointSchema).max(100),
  responsible_person_id: UuidSchema.nullable(),
  responsible: EdpResponsibleSchema.nullable(),
  confirm_client_contact_sync: z.boolean(),
  certificate_version_id: UuidSchema.nullable(),
  direct_debit: z.boolean().nullable(),
  electronic_invoice: z.boolean().nullable(),
  billing_email: EmailSchema.nullable(),
  selected_document_version_ids: z.array(UuidSchema).max(50),
  checklist_confirmations: z.array(z.object({
    rule_id: UuidSchema,
    confirmed: z.boolean(),
  }).strict()).max(100),
  paid_extraction_requested: z.literal(false),
}).strict().pipe(validatedOutput<EdpDraftPayload>());

export const EdpPersonRoleSchema = z.object({
  person_id: UuidSchema,
  organization_id: UuidSchema,
  client_id: UuidSchema,
  name: z.string(),
  nif: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  person_source: z.enum(EDP_PERSON_SOURCES),
  source_ref: z.string().nullable(),
  source_metadata: z.record(z.unknown()),
  role: z.enum(EDP_PERSON_ROLES),
  role_source: z.enum(EDP_PERSON_SOURCES),
  is_complete: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
}).strict().pipe(validatedOutput<EdpPersonRole>());

export const EdpCertificateHistorySchema = z.object({
  version_id: UuidSchema,
  organization_id: UuidSchema,
  client_id: UuidSchema,
  crc_code: z.string().nullable(),
  certificate_data: z.record(z.unknown()),
  valid_from: NullableDateSchema,
  valid_until: NullableDateSchema,
  source: z.enum(['legacy', 'manual', 'crc_lookup']),
  source_metadata: z.record(z.unknown()),
  recorded_by: UuidSchema.nullable(),
  recorded_at: z.string(),
  is_current: z.boolean(),
}).strict().pipe(validatedOutput<EdpCertificateHistory>());

export const EdpDocumentVersionSchema = z.object({
  document_id: UuidSchema,
  version_id: UuidSchema,
  person_id: UuidSchema.nullable(),
  category: z.string(),
  label: z.string(),
  side: z.enum(EDP_DOCUMENT_SIDES),
  original_name: z.string(),
  mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  size_bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  validity_suggested_on: NullableDateSchema,
  validity_confirmed_on: NullableDateSchema,
  created_at: z.string(),
}).strict().pipe(validatedOutput<EdpDocumentVersion>());

export const EdpChecklistRuleSchema = z.object({
  id: UuidSchema,
  energy_type: z.enum(EDP_ENERGY_TYPES),
  category: z.string(),
  label: z.string(),
  required: z.boolean(),
  position: z.number().int().nonnegative(),
}).strict().pipe(validatedOutput<EdpChecklistRule>());

export const EdpSettingsSchema = z.object({
  revision: z.number().int().nonnegative(),
  subject_template: z.string(),
  body_template: z.string(),
  to: z.array(EmailSchema),
  cc: z.array(EmailSchema),
  sender_name: z.string(),
  sender_email: EmailSchema,
  send_enabled: z.boolean(),
  transport: z.enum(['local_capture', 'brevo']),
  officially_confirmed: z.literal(false),
  configured: z.boolean(),
}).strict().pipe(validatedOutput<EdpSettings>());

export const EdpAttachmentManifestItemSchema = z.object({
  version_id: UuidSchema,
  document_id: UuidSchema,
  bucket_id: z.literal('edp-client-documents'),
  storage_path: z.string(),
  filename: z.string(),
  mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  size_bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().pipe(validatedOutput<EdpAttachmentManifestItem>());

export const EdpDispatchSnapshotSchema = z.object({
  schema_version: z.literal(1),
  sale: z.object({
    id: UuidSchema,
    organization_id: UuidSchema,
    client_id: UuidSchema,
    proposal_number: z.string(),
    energy_type: z.enum(EDP_ENERGY_TYPES),
    negotiation_type: z.string().nullable(),
    supply_points: z.array(EdpSupplyPointSchema),
  }).strict(),
  client: z.object({ id: UuidSchema, name: z.string(), nif: z.string().nullable() }).strict(),
  responsible: EdpReadyResponsibleSchema.extend({ person_id: UuidSchema }).strict(),
  certificate: z.object({
    version_id: UuidSchema,
    crc_code: z.string().nullable(),
    valid_until: DateSchema,
    source: z.enum(['legacy', 'manual', 'crc_lookup']),
  }).strict(),
  preferences: z.object({
    direct_debit: z.boolean(),
    electronic_invoice: z.boolean(),
    billing_email: EmailSchema.nullable(),
  }).strict(),
  delivery: z.object({
    to: z.array(EmailSchema),
    cc: z.array(EmailSchema),
    sender_name: z.string(),
    sender_email: EmailSchema,
    transport: z.enum(['local_capture', 'brevo']),
    subject: z.string(),
    html: z.string(),
  }).strict(),
  checklist: z.array(z.object({
    rule_id: UuidSchema,
    category: z.string(),
    label: z.string(),
    required: z.boolean(),
    confirmed: z.boolean(),
  }).strict()),
  attachments: z.array(EdpAttachmentManifestItemSchema),
  draft_revision: z.number().int().positive(),
  created_at: z.string(),
}).strict().pipe(validatedOutput<EdpDispatchSnapshot>());

export const EdpDispatchHistorySchema = z.object({
  dispatch_id: UuidSchema,
  sale_id: UuidSchema,
  state: z.enum(EDP_DISPATCH_STATES),
  snapshot: EdpDispatchSnapshotSchema,
  attachment_manifest: z.array(EdpAttachmentManifestItemSchema),
  email_send_id: UuidSchema.nullable(),
  created_by: UuidSchema,
  created_by_name: z.string().nullable(),
  created_at: z.string(),
  accepted_at: z.string().nullable(),
}).strict().pipe(validatedOutput<EdpDispatchHistory>());

export const EdpSavedDraftSchema = z.object({
  sale_id: UuidSchema,
  revision: z.number().int().positive(),
  payload: EdpDraftPayloadSchema,
  readiness: z.enum(EDP_READINESS),
  blocking_reasons: z.array(z.string()),
  updated_at: z.string(),
}).strict().pipe(validatedOutput<EdpSavedDraft>());

export const EdpReserveDispatchResponseSchema = z.object({
  dispatch_id: UuidSchema,
  attempt_id: UuidSchema,
  state: z.enum(EDP_DISPATCH_STATES),
  same_request: z.boolean(),
  snapshot: EdpDispatchSnapshotSchema,
  attachment_manifest: z.array(EdpAttachmentManifestItemSchema),
}).strict().pipe(validatedOutput<EdpReserveDispatchResponse>());

export const EdpDispatchEdgeResponseSchema = z.object({
  dispatch_id: UuidSchema,
  attempt_id: UuidSchema,
  state: z.enum(EDP_DISPATCH_STATES),
  same_request: z.boolean(),
  snapshot: EdpDispatchSnapshotSchema,
  attachment_manifest: z.array(EdpAttachmentManifestItemSchema),
  message_id: z.string().nullable(),
}).strict().pipe(validatedOutput<EdpDispatchEdgeResponse>());

export const EdpDocumentUploadResponseSchema = EdpDocumentVersionSchema;
export const EdpSignedUrlResponseSchema = z.object({ url: z.string().url(), expires_in: z.literal(60) })
  .strict().pipe(validatedOutput<EdpSignedUrlResponse>());
export const EdpArchiveDocumentResponseSchema = z.object({ document_id: UuidSchema, archived_at: z.string() })
  .strict().pipe(validatedOutput<EdpArchiveDocumentResponse>());
export const EdpSettingsResponseSchema = z.object({
  settings: EdpSettingsSchema,
  checklist: z.array(EdpChecklistRuleSchema),
}).strict().pipe(validatedOutput<EdpSettingsResponse>());

export const EdpSaleContextSchema = z.object({
  sale: z.object({
    id: UuidSchema,
    organization_id: UuidSchema,
    client_id: UuidSchema,
    proposal_id: UuidSchema.nullable(),
    proposal_type: z.string().nullable(),
    negotiation_type: z.string().nullable(),
    edp_proposal_number: z.string().nullable(),
    created_by: UuidSchema.nullable(),
  }).strict(),
  client: z.object({
    id: UuidSchema,
    name: z.string(),
    nif: z.string().nullable(),
    assigned_to: UuidSchema.nullable(),
  }).strict(),
  people: z.array(EdpPersonRoleSchema),
  certificate_history: z.array(EdpCertificateHistorySchema),
  documents: z.array(EdpDocumentVersionSchema),
  settings: EdpSettingsSchema,
  checklist: z.array(EdpChecklistRuleSchema),
  suggested_payload: EdpDraftPayloadSchema,
  draft: EdpSavedDraftSchema.nullable(),
  history: z.array(EdpDispatchHistorySchema),
}).strict().pipe(validatedOutput<EdpSaleContext>());

export function parseEdpDraftPayload(input: unknown): EdpDraftPayload {
  return EdpDraftPayloadSchema.parse(input);
}

export function parseEdpSaleContext(input: unknown): EdpSaleContext {
  return EdpSaleContextSchema.parse(input);
}

export function parseEdpSavedDraft(input: unknown): EdpSavedDraft {
  return EdpSavedDraftSchema.parse(input);
}

export function parseEdpDispatchResponse(input: unknown): EdpDispatchEdgeResponse {
  return EdpDispatchEdgeResponseSchema.parse(input);
}

export function evaluateEdpReadiness(
  payload: EdpDraftPayload,
  context: EdpReadinessContext,
): EdpReadinessResult {
  const reasons: string[] = [];
  if (!payload.proposal_number) reasons.push('proposal_number_missing');
  if (payload.supply_points.some((point) => point.contract_start_date === null)) reasons.push('contract_start_date_missing');
  if (payload.direct_debit === null) reasons.push('direct_debit_missing');
  if (payload.electronic_invoice === null) reasons.push('electronic_invoice_missing');
  if (payload.electronic_invoice === true && payload.billing_email === null) reasons.push('billing_email_required');
  const responsibleComplete = payload.responsible !== null
    && payload.responsible.name.length > 0
    && payload.responsible.phone.length > 0
    && EmailSchema.safeParse(payload.responsible.email).success;
  if (!context.decision_maker_complete || !responsibleComplete) reasons.push('decision_maker_incomplete');
  if (!context.certificate) reasons.push('certificate_missing');
  else if (!context.certificate.valid_until) reasons.push('certificate_validity_unknown');
  else if (context.certificate.valid_until < context.now) reasons.push('certificate_expired');
  const available = new Set(context.available_document_version_ids);
  if (payload.selected_document_version_ids.some((id) => !available.has(id))) reasons.push('selected_document_missing');
  const confirmed = new Set(payload.checklist_confirmations.filter((item) => item.confirmed).map((item) => item.rule_id));
  if (context.required_checklist_rule_ids.some((id) => !confirmed.has(id))) reasons.push('checklist_incomplete');
  if (!context.settings_configured) reasons.push('settings_missing');
  return reasons.length === 0
    ? { readiness: 'ready', blocking_reasons: [] }
    : { readiness: 'blocked', blocking_reasons: reasons };
}
