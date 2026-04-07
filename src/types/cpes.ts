export type CpeStatus = 'active' | 'inactive' | 'pending' | 'returned';
export type NivelTensao = 'BTE' | 'BTN' | 'MT';
export type RenewalStatus = 'pending' | 'renewed' | 'switched';

export interface Cpe {
  id: string;
  organization_id: string;
  client_id: string;
  equipment_type: string;
  serial_number?: string | null;
  comercializador: string;
  fidelizacao_start?: string | null;
  fidelizacao_end?: string | null;
  status: CpeStatus;
  nivel_tensao?: NivelTensao | null;
  notes?: string | null;
  renewal_status?: RenewalStatus | null;
  created_at: string;
  updated_at: string;
}

export const NIVEL_TENSAO_OPTIONS: NivelTensao[] = ['BTE', 'BTN', 'MT'];

export const NIVEL_TENSAO_LABELS: Record<NivelTensao, string> = {
  BTE: 'BTE',
  BTN: 'BTN',
  MT: 'MT',
};

export const NIVEL_TENSAO_STYLES: Record<NivelTensao, { bg: string; text: string; border: string }> = {
  BTE: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  BTN: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  MT: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
};

export const CPE_STATUS_LABELS: Record<CpeStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  pending: 'Pendente',
  returned: 'Devolvido',
};

export const CPE_STATUS_STYLES: Record<CpeStatus, { bg: string; text: string; border: string }> = {
  active: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  inactive: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted' },
  pending: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  returned: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
};

// Common equipment types for telecom/energy
export const EQUIPMENT_TYPES = [
  'Router',
  'ONT',
  'Decoder/STB',
  'Repetidor WiFi',
  'Smart Meter',
  'Contador Elétrico',
  'Contador Gás',
  'Outro',
];

// Energy types for telecom niche (Portuguese energy market)
export const ENERGY_TYPES = [
  'Energia',
  'Gás',
  'Outro',
];

// Common comercializadores in Portugal (mixed)
export const COMERCIALIZADORES = [
  // Telecom
  'MEO',
  'NOS',
  'Vodafone',
  'NOWO',
  'Digi',
  // Energy
  'EDP Comercial',
  'Galp',
  'Endesa',
  'Iberdrola',
  'Goldenergy',
  'Luzboa',
  'Outro',
];

// Energy comercializadores for telecom niche (E-Redes Portugal)
export const ENERGY_COMERCIALIZADORES = [
  'EDP Comercial',
  'Endesa Energia',
  'Galp Power',
  'Iberdrola',
  'Goldenergy',
  'Luzboa',
  'Repsol Energia',
  'SU Eletricidade',
  'Energia Unida',
  'Pleno Energia',
  'Nossa Energia',
  'Alfa Energia',
  'Axpo Energia',
  'Muon Electric',
  'Coopernico',
  'Outro',
];
