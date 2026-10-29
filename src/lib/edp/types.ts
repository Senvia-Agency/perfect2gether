export const EDP_ENERGY_TYPES = ['ee', 'gn', 'ee_gn'] as const;
export const EDP_POINT_KINDS = ['cpe', 'cui'] as const;
export const EDP_READINESS = ['draft', 'ready', 'blocked'] as const;
export const EDP_DISPATCH_STATES = ['reserved', 'accepted', 'failed', 'uncertain'] as const;
export const EDP_PERSON_ROLES = ['decision_maker', 'legal_manager', 'shareholder'] as const;
export const EDP_PERSON_SOURCES = ['legacy', 'manual', 'mj', 'crc_lookup'] as const;
export const EDP_DOCUMENT_SIDES = ['single', 'front', 'back'] as const;

export type EdpEnergyType = (typeof EDP_ENERGY_TYPES)[number];
export type EdpPointKind = (typeof EDP_POINT_KINDS)[number];
export type EdpReadiness = (typeof EDP_READINESS)[number];
export type EdpDispatchState = (typeof EDP_DISPATCH_STATES)[number];
export type EdpPersonRole = (typeof EDP_PERSON_ROLES)[number];
export type EdpPersonSource = (typeof EDP_PERSON_SOURCES)[number];
export type EdpDocumentSide = (typeof EDP_DOCUMENT_SIDES)[number];

export type EdpReadinessResult = {
  readonly readiness: EdpReadiness;
  readonly blocking_reasons: readonly string[];
};

export type EdpReadinessCertificate = {
  readonly id: string;
  readonly valid_until: string | null;
  readonly is_current: boolean;
};

export type EdpReadinessContext = {
  readonly now: string;
  readonly certificate: EdpReadinessCertificate | null;
  readonly decision_maker_complete: boolean;
  readonly available_document_version_ids: readonly string[];
  readonly required_checklist_rule_ids: readonly string[];
  readonly settings_configured: boolean;
};

export type EdpTemplateVariables = Readonly<Record<string, string | number | boolean | null | undefined>>;

export type EdpPreviewInput = {
  readonly settings: {
    readonly subject_template: string;
    readonly body_template: string;
  };
  readonly draft: {
    readonly proposal_number: string;
    readonly energy_type: EdpEnergyType;
    readonly billing_email: string | null;
  };
  readonly client: {
    readonly name: string;
    readonly nif: string | null;
  };
};

export type EdpPreview = {
  readonly subject: string;
  readonly html: string;
};
