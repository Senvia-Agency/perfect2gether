export interface Prospect {
  id: string;
  organization_id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  nif: string | null;
  cpe: string | null;
  segment: string | null;
  status: string;
  annual_consumption_kwh: number | null;
  observations: string | null;
  source: string;
  source_file_name: string | null;
  imported_at: string;
  imported_by: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  converted_to_lead: boolean;
  converted_lead_id: string | null;
  converted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProspectSalesperson {
  user_id: string;
  full_name: string;
}

export interface ProspectImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  firstError: string | null;
}

export interface DistributeProspectsPayload {
  prospectIds: string[];
  quantity: number;
  salespersonIds?: string[];
}
