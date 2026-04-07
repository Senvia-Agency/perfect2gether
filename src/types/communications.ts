export type CommunicationType = 'call' | 'whatsapp' | 'email' | 'note';
export type CommunicationDirection = 'inbound' | 'outbound';

export interface ClientCommunication {
  id: string;
  organization_id: string;
  client_id: string;
  created_by?: string | null;
  type: CommunicationType;
  direction?: CommunicationDirection | null;
  subject?: string | null;
  content?: string | null;
  duration_seconds?: number | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  call: 'Chamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  note: 'Nota',
};

export const COMMUNICATION_DIRECTION_LABELS: Record<CommunicationDirection, string> = {
  inbound: 'Recebida',
  outbound: 'Enviada',
};

export const COMMUNICATION_TYPE_OPTIONS = [
  { value: 'call', label: 'Chamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'note', label: 'Nota' },
] as const;

export const COMMUNICATION_DIRECTION_OPTIONS = [
  { value: 'inbound', label: 'Recebida' },
  { value: 'outbound', label: 'Enviada' },
] as const;
