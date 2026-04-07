// Shared automation trigger types and delay options
// Used by TemplateAutomationSection in template modals

export const TRIGGER_TYPES = [
  { value: 'lead_created', label: 'Novo Lead Criado' },
  { value: 'lead_status_changed', label: 'Lead Muda de Etapa' },
  { value: 'client_created', label: 'Novo Cliente Criado' },
  { value: 'client_status_changed', label: 'Cliente Muda de Estado' },
  { value: 'sale_status_changed', label: 'Venda Muda de Estado' },
  { value: 'sale_renewal_due_today', label: 'Renovação Vence Hoje' },
  { value: 'sale_renewal_due_in_2_days', label: 'Renovação Vence em 2 Dias' },
  { value: 'proposal_created', label: 'Nova Proposta Criada' },
  { value: 'proposal_status_changed', label: 'Proposta Muda de Estado' },
] as const;

export const DELAY_OPTIONS = [
  { value: 0, label: 'Imediato' },
  { value: 5, label: '5 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 360, label: '6 horas' },
  { value: 1440, label: '1 dia' },
  { value: 2880, label: '2 dias' },
  { value: 4320, label: '3 dias' },
  { value: 10080, label: '7 dias' },
] as const;
