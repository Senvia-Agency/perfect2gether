// Generic field config shared across modules
export interface FieldConfig {
  visible: boolean;
  required: boolean;
  label: string;
}

// ==================== LEADS ====================
export type LeadFieldKey = 'company_nif' | 'company_name' | 'name' | 'email' | 'phone' | 'source' | 'temperature' | 'tipologia' | 'consumo_anual' | 'value' | 'notes';

export type LeadFieldsSettings = Record<LeadFieldKey, FieldConfig>;

export const DEFAULT_LEAD_FIELDS_SETTINGS: LeadFieldsSettings = {
  company_nif: { visible: true, required: true, label: 'NIF Empresa' },
  company_name: { visible: true, required: true, label: 'Nome Empresa' },
  name: { visible: true, required: true, label: 'Nome' },
  email: { visible: true, required: true, label: 'Email' },
  phone: { visible: true, required: true, label: 'Telefone' },
  source: { visible: true, required: false, label: 'Origem' },
  temperature: { visible: true, required: false, label: 'Temperatura' },
  tipologia: { visible: true, required: false, label: 'Tipologia' },
  consumo_anual: { visible: true, required: false, label: 'Consumo Anual (kWh)' },
  value: { visible: true, required: false, label: 'Valor Estimado' },
  notes: { visible: true, required: false, label: 'Observações' },
};

export const LEAD_FIELD_ORDER: LeadFieldKey[] = ['company_nif', 'company_name', 'name', 'email', 'phone', 'source', 'temperature', 'tipologia', 'consumo_anual', 'value', 'notes'];

// ==================== PROPOSTAS ====================
export type ProposalFieldKey = 'type' | 'value' | 'date' | 'notes';

export type ProposalFieldsSettings = Record<ProposalFieldKey, FieldConfig>;

export const DEFAULT_PROPOSAL_FIELDS_SETTINGS: ProposalFieldsSettings = {
  type: { visible: true, required: true, label: 'Tipo de Proposta' },
  value: { visible: true, required: true, label: 'Valor Total' },
  date: { visible: true, required: false, label: 'Data da Proposta' },
  notes: { visible: true, required: false, label: 'Notas' },
};

export const PROPOSAL_FIELD_ORDER: ProposalFieldKey[] = ['type', 'value', 'date', 'notes'];

// ==================== VENDAS ====================
export type SaleFieldKey = 'value' | 'payment_method' | 'due_date' | 'notes' | 'edp_proposal_number';

export type SaleFieldsSettings = Record<SaleFieldKey, FieldConfig>;

export const DEFAULT_SALE_FIELDS_SETTINGS: SaleFieldsSettings = {
  value: { visible: true, required: true, label: 'Valor Total' },
  payment_method: { visible: true, required: false, label: 'Método de Pagamento' },
  due_date: { visible: true, required: false, label: 'Data de Vencimento' },
  notes: { visible: true, required: false, label: 'Notas' },
  edp_proposal_number: { visible: true, required: true, label: 'Numero Proposta EDP' },
};

export const SALE_FIELD_ORDER: SaleFieldKey[] = ['value', 'payment_method', 'due_date', 'notes', 'edp_proposal_number'];
