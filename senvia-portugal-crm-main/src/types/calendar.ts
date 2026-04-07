export type EventType = 'meeting' | 'call' | 'task' | 'follow_up';
export type EventStatus = 'pending' | 'completed' | 'cancelled';

export interface CalendarEvent {
  id: string;
  organization_id: string;
  user_id: string;
  lead_id?: string | null;
  title: string;
  description?: string | null;
  event_type: EventType;
  start_time: string;
  end_time?: string | null;
  all_day: boolean;
  meeting_link?: string | null;
  status: EventStatus;
  reminder_minutes?: number | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  lead?: {
    id: string;
    name: string;
  } | null;
  user?: {
    id: string;
    full_name: string;
  } | null;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: 'Reunião',
  call: 'Chamada',
  task: 'Tarefa',
  follow_up: 'Follow-up',
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: 'bg-blue-500',
  call: 'bg-green-500',
  task: 'bg-yellow-500',
  follow_up: 'bg-purple-500',
};

export const EVENT_TYPE_TEXT_COLORS: Record<EventType, string> = {
  meeting: 'text-blue-500',
  call: 'text-green-500',
  task: 'text-yellow-500',
  follow_up: 'text-purple-500',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  pending: 'Pendente',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const REMINDER_OPTIONS = [
  { value: null, label: 'Sem lembrete' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
];
