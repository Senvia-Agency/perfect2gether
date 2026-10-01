export type RequestType = 'expense' | 'vacation' | 'invoice';
export type RequestStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface InternalRequest {
  id: string;
  organization_id: string;
  submitted_by: string;
  submitted_at: string;
  request_type: RequestType;
  title: string;
  description: string | null;
  amount: number | null;
  file_url: string | null;
  expense_date: string | null;
  period_start: string | null;
  period_end: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  submitter?: { full_name: string; avatar_url: string | null };
  reviewer?: { full_name: string };
}

export interface InternalRequestAttachment {
  id: string;
  organization_id: string;
  request_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const REQUEST_ACCEPTED_FILES = '.pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp';

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  expense: 'Despesa',
  vacation: 'Férias',
  invoice: 'Fatura',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  rejected: 'Rejeitado',
};

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};
