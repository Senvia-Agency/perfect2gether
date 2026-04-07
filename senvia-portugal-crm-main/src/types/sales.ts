export type NegotiationType = 'angariacao' | 'angariacao_indexado' | 'renovacao' | 'sem_volume';
export type SaleStatus = 'in_progress' | 'fulfilled' | 'delivered' | 'cancelled';
export type PaymentMethod = 'mbway' | 'transfer' | 'cash' | 'card' | 'check' | 'other';
export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type ProposalType = 'energia' | 'servicos';
export type ModeloServico = 'transacional' | 'saas';

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  in_progress: 'Em Progresso',
  fulfilled: 'Entregue',
  delivered: 'Concluída',
  cancelled: 'Cancelado',
};

export const SALE_STATUS_COLORS: Record<SaleStatus, string> = {
  in_progress: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  fulfilled: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  delivered: 'bg-green-500/20 text-green-500 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
};

export const SALE_STATUSES: SaleStatus[] = ['in_progress', 'fulfilled', 'delivered', 'cancelled'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mbway: 'MB Way',
  transfer: 'Transferência',
  cash: 'Dinheiro',
  card: 'Cartão',
  check: 'Cheque',
  other: 'Outro',
};

export const PAYMENT_METHODS: PaymentMethod[] = ['mbway', 'transfer', 'cash', 'card', 'check', 'other'];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
  partial: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-500 border-green-500/30',
};

// Payment record types (for sale_payments table)
export type PaymentRecordStatus = 'pending' | 'paid';

export interface SalePayment {
  id: string;
  organization_id: string;
  sale_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod | null;
  invoice_reference: string | null;
  invoice_file_url: string | null;
  invoicexpress_id?: number | null;
  qr_code_url?: string | null;
  status: PaymentRecordStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const PAYMENT_RECORD_STATUS_LABELS: Record<PaymentRecordStatus, string> = {
  pending: 'Agendado',
  paid: 'Pago',
};

export const PAYMENT_RECORD_STATUS_COLORS: Record<PaymentRecordStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
  paid: 'bg-green-500/20 text-green-500 border-green-500/30',
};

export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'partial', 'paid'];

export type RecurringStatus = 'active' | 'cancelled' | 'paused' | 'pending';

export const RECURRING_STATUS_LABELS: Record<RecurringStatus, string> = {
  active: 'Ativo',
  cancelled: 'Cancelado',
  paused: 'Pausado',
  pending: 'Pendente',
};

export const RECURRING_STATUS_COLORS: Record<RecurringStatus, string> = {
  active: 'bg-green-500/20 text-green-500 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
  paused: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
  pending: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
};

export interface Sale {
  id: string;
  organization_id: string;
  code: string;
  proposal_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  status: SaleStatus;
  total_value: number;
  subtotal: number;
  discount: number;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  due_date: string | null;
  paid_date: string | null;
  invoice_reference: string | null;
  sale_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Campos do tipo de proposta
  proposal_type: ProposalType | null;
  
  // Campos Energia
  consumo_anual: number | null;
  margem: number | null;
  dbl: number | null;
  anos_contrato: number | null;
  
  // Campos Serviços
  modelo_servico: ModeloServico | null;
  kwp: number | null;
  
  // Comum
  comissao: number | null;
  
  // Tipo de Negociação e Serviços/Produtos
  negotiation_type: NegotiationType | null;
  servicos_produtos: string[] | null;
  
  // Campos de Recorrência
  has_recurring: boolean;
  recurring_value: number;
  recurring_status: RecurringStatus | null;
  next_renewal_date: string | null;
  last_renewal_date: string | null;

  // Data de Ativação
  activation_date?: string | null;

  // Numero Proposta EDP
  edp_proposal_number?: string | null;

  // InvoiceXpress
  invoicexpress_id: number | null;
  invoicexpress_type: string | null;
  qr_code_url?: string | null;
  invoice_pdf_url?: string | null;
  credit_note_id?: number | null;
  credit_note_reference?: string | null;
}

export interface SaleWithDetails extends Sale {
  lead?: {
    name: string;
    email: string;
    phone: string;
    assigned_to?: string | null;
  } | null;
  proposal?: {
    id: string;
    code?: string;
    proposal_date: string;
  } | null;
  client?: {
    id: string;
    name: string;
    code?: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    nif?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  first_due_date: string | null;
  created_at: string;
}

export interface SaleItemWithProduct extends SaleItem {
  product?: {
    name: string;
    price: number | null;
    is_recurring?: boolean;
  } | null;
}
