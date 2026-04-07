// Senvia OS Type Definitions

export type AppRole = 'super_admin' | 'admin' | 'viewer' | 'salesperson';
export type LeadStatus = 'new' | 'contacted' | 'scheduled' | 'proposal' | 'won' | 'lost';
export type LeadTemperature = 'cold' | 'warm' | 'hot';
export type LeadTipologia = 'ee' | 'gas' | 'servicos' | 'ee_servicos';
export type OrganizationPlan = 'starter' | 'pro' | 'elite';

// Meta Ads Pixel
export interface MetaPixel {
  id: string;
  name: string;
  pixel_id: string;
  enabled: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  public_key: string;
  plan: OrganizationPlan;
  webhook_url?: string | null;
  whatsapp_instance?: string | null;
  whatsapp_number?: string | null;
  whatsapp_api_key?: string | null;
  ai_qualification_rules?: string | null;
  form_settings?: FormSettings;
  meta_pixels?: MetaPixel[];
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string | null;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Lead {
  id: string;
  organization_id: string;
  form_id?: string | null;
  name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  temperature?: LeadTemperature;
  notes?: string;
  source?: string;
  value?: number;
  gdpr_consent: boolean;
  automation_enabled: boolean;
  custom_data?: Record<string, string | number | boolean | string[] | null>;
  assigned_to?: string | null;
  // Telecom template fields
  tipologia?: LeadTipologia | null;
  consumo_anual?: number | null;
  company_nif?: string | null;
  company_name?: string | null;
  created_at: string;
  updated_at?: string;
}

// Form entity (multiple per organization)
export interface Form {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  form_settings: FormSettings;
  is_default: boolean;
  is_active: boolean;
  // Automation fields (per-form)
  msg_template_hot?: string | null;
  msg_template_warm?: string | null;
  msg_template_cold?: string | null;
  ai_qualification_rules?: string | null;
  // Meta Pixels (per-form)
  meta_pixels?: MetaPixel[];
  // Auto-assignment (per-form)
  assigned_to?: string | null;
  // Target pipeline stage (per-form)
  target_stage?: string | null;
  created_at: string;
  updated_at: string;
}

// PT-PT Status Labels
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Novo',
  contacted: 'Contactado',
  scheduled: 'Agendado',
  proposal: 'Proposta',
  won: 'Ganho',
  lost: 'Perdido',
};

// PT-PT Role Labels
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Administrador',
  admin: 'Administrador',
  viewer: 'Visualizador',
  salesperson: 'Comercial',
};

// PT-PT Plan Labels
export const PLAN_LABELS: Record<OrganizationPlan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  elite: 'Elite',
};

// Kanban column order
export const KANBAN_COLUMNS: LeadStatus[] = ['new', 'contacted', 'scheduled', 'proposal', 'won', 'lost'];

// PT-PT Temperature Labels
export const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  cold: 'Frio',
  warm: 'Morno',
  hot: 'Quente',
};

// Temperature Styles
export const TEMPERATURE_STYLES: Record<LeadTemperature, { color: string; emoji: string }> = {
  cold: { color: 'text-blue-500', emoji: '🥶' },
  warm: { color: 'text-amber-500', emoji: '😐' },
  hot: { color: 'text-red-500', emoji: '🔥' },
};

// PT-PT Tipologia Labels (for Telecom template)
export const TIPOLOGIA_LABELS: Record<LeadTipologia, string> = {
  ee: 'EE',
  gas: 'Gás',
  servicos: 'Serviços',
  ee_servicos: 'EE + Serviços',
};

// Tipologia Styles
export const TIPOLOGIA_STYLES: Record<LeadTipologia, { color: string; emoji: string; bgClass: string }> = {
  ee: { color: 'text-yellow-500', emoji: '⚡', bgClass: 'bg-yellow-500/10' },
  gas: { color: 'text-orange-500', emoji: '🔥', bgClass: 'bg-orange-500/10' },
  servicos: { color: 'text-purple-500', emoji: '🔧', bgClass: 'bg-purple-500/10' },
  ee_servicos: { color: 'text-green-500', emoji: '⚡🔧', bgClass: 'bg-green-500/10' },
};

export type FormMode = 'traditional' | 'conversational';

// Custom Field Types
export type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea';

export interface CustomField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  order: number;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto',
  number: 'Número',
  select: 'Seleção',
  checkbox: 'Checkbox',
  textarea: 'Texto Longo',
};

export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  text: 'Type',
  number: 'Hash',
  select: 'List',
  checkbox: 'CheckSquare',
  textarea: 'AlignLeft',
};

// Fixed Field Configuration
export interface FixedFieldConfig {
  visible: boolean;
  required: boolean;
  label: string;
}

// Form Settings Interface
export interface FormSettings {
  mode: FormMode;
  title: string;
  subtitle: string;
  logo_url: string | null;
  primary_color: string;
  fields: {
    name: FixedFieldConfig;
    email: FixedFieldConfig;
    phone: FixedFieldConfig;
    message: FixedFieldConfig;
  };
  success_message: {
    title: string;
    description: string;
  };
  error_message: string;
  submit_button_text: string;
  custom_fields: CustomField[];
}

// Default Form Settings - TODOS os campos começam invisíveis
export const DEFAULT_FORM_SETTINGS: FormSettings = {
  mode: 'traditional',
  title: 'Deixe o seu Contacto',
  subtitle: 'Preencha os dados abaixo e entraremos em contacto consigo.',
  logo_url: null,
  primary_color: '#3B82F6',
  fields: {
    name: { visible: false, required: false, label: 'Nome Completo' },
    email: { visible: false, required: false, label: 'Email' },
    phone: { visible: false, required: false, label: 'Telemóvel' },
    message: { visible: false, required: false, label: 'Mensagem' },
  },
  success_message: {
    title: 'Obrigado!',
    description: 'Recebemos o seu contacto e entraremos em contacto brevemente.',
  },
  error_message: 'Não foi possível enviar o formulário. Tente novamente.',
  submit_button_text: 'Enviar',
  custom_fields: [],
};

// Helper to migrate old settings format to new format
export function migrateFormSettings(settings: any): FormSettings {
  // Sanitize custom_fields to ensure all have labels
  const sanitizeCustomFields = (fields: any[]): CustomField[] => {
    if (!Array.isArray(fields)) return [];
    return fields.map((f: any) => ({
      ...f,
      label: f.label || '',
      type: f.type || 'text',
      required: f.required ?? false,
      order: f.order ?? 0,
    }));
  };

  // If already in new format, return with sanitized custom_fields
  if (settings?.fields?.name?.visible !== undefined) {
    return {
      mode: settings.mode || 'traditional',
      submit_button_text: settings.submit_button_text || DEFAULT_FORM_SETTINGS.submit_button_text,
      ...settings,
      custom_fields: sanitizeCustomFields(settings.custom_fields),
    } as FormSettings;
  }
  
  // Migrate from old format
  const oldLabels = settings?.labels || {};
  const showMessage = settings?.show_message_field ?? false;
  
  return {
    mode: 'traditional',
    title: settings?.title || DEFAULT_FORM_SETTINGS.title,
    subtitle: settings?.subtitle || DEFAULT_FORM_SETTINGS.subtitle,
    logo_url: settings?.logo_url || null,
    primary_color: settings?.primary_color || DEFAULT_FORM_SETTINGS.primary_color,
    fields: {
      name: { visible: true, required: true, label: oldLabels.name || 'Nome Completo' },
      email: { visible: true, required: true, label: oldLabels.email || 'Email' },
      phone: { visible: true, required: true, label: oldLabels.phone || 'Telemóvel' },
      message: { visible: showMessage, required: false, label: oldLabels.message || 'Mensagem (opcional)' },
    },
    success_message: settings?.success_message || DEFAULT_FORM_SETTINGS.success_message,
    error_message: settings?.error_message || DEFAULT_FORM_SETTINGS.error_message,
    submit_button_text: settings?.submit_button_text || DEFAULT_FORM_SETTINGS.submit_button_text,
    custom_fields: sanitizeCustomFields(settings?.custom_fields),
  };
}
