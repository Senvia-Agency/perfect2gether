// Pipeline Templates for different business niches

export type NicheType = 'generic' | 'clinic' | 'construction' | 'telecom' | 'ecommerce' | 'real_estate';

export interface PipelineStageTemplate {
  name: string;
  key: string;
  color: string;
  position: number;
  is_final_positive: boolean;
  is_final_negative: boolean;
}

export interface DefaultModules {
  proposals: boolean;
  calendar: boolean;
  sales: boolean;
  ecommerce: boolean;
}

export interface NicheTemplate {
  id: NicheType;
  name: string;
  description: string;
  icon: string;
  stages: PipelineStageTemplate[];
  defaultModules: DefaultModules;
}

export const NICHE_TEMPLATES: NicheTemplate[] = [
  {
    id: 'generic',
    name: 'Genérico',
    description: 'Pipeline padrão para qualquer tipo de negócio',
    icon: 'Building2',
    defaultModules: { proposals: true, calendar: true, sales: true, ecommerce: false },
    stages: [
      { name: 'Novo', key: 'new', color: '#3B82F6', position: 1, is_final_positive: false, is_final_negative: false },
      { name: 'Contactado', key: 'contacted', color: '#A855F7', position: 2, is_final_positive: false, is_final_negative: false },
      { name: 'Agendado', key: 'scheduled', color: '#F59E0B', position: 3, is_final_positive: false, is_final_negative: false },
      { name: 'Proposta', key: 'proposal', color: '#06B6D4', position: 4, is_final_positive: false, is_final_negative: false },
      { name: 'Ganho', key: 'won', color: '#22C55E', position: 5, is_final_positive: true, is_final_negative: false },
      { name: 'Perdido', key: 'lost', color: '#6B7280', position: 6, is_final_positive: false, is_final_negative: true },
    ],
  },
  {
    id: 'clinic',
    name: 'Clínica / Saúde',
    description: 'Para clínicas dentárias, estéticas, médicas',
    icon: 'Heart',
    defaultModules: { proposals: true, calendar: true, sales: true, ecommerce: false },
    stages: [
      { name: 'Novo Lead', key: 'new', color: '#3B82F6', position: 1, is_final_positive: false, is_final_negative: false },
      { name: 'Triagem', key: 'triage', color: '#A855F7', position: 2, is_final_positive: false, is_final_negative: false },
      { name: 'Consulta Marcada', key: 'scheduled', color: '#F59E0B', position: 3, is_final_positive: false, is_final_negative: false },
      { name: 'Em Tratamento', key: 'treatment', color: '#06B6D4', position: 4, is_final_positive: false, is_final_negative: false },
      { name: 'Pago', key: 'paid', color: '#22C55E', position: 5, is_final_positive: true, is_final_negative: false },
      { name: 'Desistiu', key: 'dropped', color: '#6B7280', position: 6, is_final_positive: false, is_final_negative: true },
    ],
  },
  {
    id: 'construction',
    name: 'Construção / Obras',
    description: 'Para construtoras, remodelações, obras',
    icon: 'Hammer',
    defaultModules: { proposals: true, calendar: true, sales: true, ecommerce: false },
    stages: [
      { name: 'Lead', key: 'new', color: '#3B82F6', position: 1, is_final_positive: false, is_final_negative: false },
      { name: 'Visita Marcada', key: 'visit', color: '#A855F7', position: 2, is_final_positive: false, is_final_negative: false },
      { name: 'Orçamento', key: 'quote', color: '#F59E0B', position: 3, is_final_positive: false, is_final_negative: false },
      { name: 'Negociação', key: 'negotiation', color: '#06B6D4', position: 4, is_final_positive: false, is_final_negative: false },
      { name: 'Obra em Curso', key: 'in_progress', color: '#8B5CF6', position: 5, is_final_positive: false, is_final_negative: false },
      { name: 'Concluído', key: 'completed', color: '#22C55E', position: 6, is_final_positive: true, is_final_negative: false },
      { name: 'Perdido', key: 'lost', color: '#6B7280', position: 7, is_final_positive: false, is_final_negative: true },
    ],
  },
  {
    id: 'telecom',
    name: 'Telecomunicações',
    description: 'Para operadoras, instalações, energia',
    icon: 'Wifi',
    defaultModules: { proposals: true, calendar: true, sales: true, ecommerce: false },
    stages: [
      { name: 'Lead', key: 'new', color: '#3B82F6', position: 1, is_final_positive: false, is_final_negative: false },
      { name: 'Contactado', key: 'contactado', color: '#A855F7', position: 2, is_final_positive: false, is_final_negative: false },
      { name: 'Agendado', key: 'scheduled', color: '#F59E0B', position: 3, is_final_positive: false, is_final_negative: false },
      { name: 'Ganho', key: 'won', color: '#22C55E', position: 4, is_final_positive: true, is_final_negative: false },
      { name: 'Perdido', key: 'perdido', color: '#6B7280', position: 5, is_final_positive: false, is_final_negative: true },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Para lojas online, dropshipping',
    icon: 'ShoppingCart',
    defaultModules: { proposals: false, calendar: false, sales: true, ecommerce: true },
    stages: [
      { name: 'Carrinho', key: 'cart', color: '#3B82F6', position: 1, is_final_positive: false, is_final_negative: false },
      { name: 'Checkout', key: 'checkout', color: '#A855F7', position: 2, is_final_positive: false, is_final_negative: false },
      { name: 'Pago', key: 'paid', color: '#F59E0B', position: 3, is_final_positive: false, is_final_negative: false },
      { name: 'Enviado', key: 'shipped', color: '#06B6D4', position: 4, is_final_positive: false, is_final_negative: false },
      { name: 'Entregue', key: 'delivered', color: '#22C55E', position: 5, is_final_positive: true, is_final_negative: false },
      { name: 'Devolvido', key: 'returned', color: '#EF4444', position: 6, is_final_positive: false, is_final_negative: false },
      { name: 'Abandonado', key: 'abandoned', color: '#6B7280', position: 7, is_final_positive: false, is_final_negative: true },
    ],
  },
  {
    id: 'real_estate',
    name: 'Imobiliário',
    description: 'Para imobiliárias, mediação',
    icon: 'Home',
    defaultModules: { proposals: true, calendar: true, sales: true, ecommerce: false },
    stages: [
      { name: 'Lead', key: 'new', color: '#3B82F6', position: 1, is_final_positive: false, is_final_negative: false },
      { name: 'Contactado', key: 'contacted', color: '#A855F7', position: 2, is_final_positive: false, is_final_negative: false },
      { name: 'Visita Marcada', key: 'visit_scheduled', color: '#F59E0B', position: 3, is_final_positive: false, is_final_negative: false },
      { name: 'Visita Feita', key: 'visited', color: '#06B6D4', position: 4, is_final_positive: false, is_final_negative: false },
      { name: 'Proposta', key: 'proposal', color: '#8B5CF6', position: 5, is_final_positive: false, is_final_negative: false },
      { name: 'CPCV', key: 'cpcv', color: '#EC4899', position: 6, is_final_positive: false, is_final_negative: false },
      { name: 'Escritura', key: 'deed', color: '#22C55E', position: 7, is_final_positive: true, is_final_negative: false },
      { name: 'Perdido', key: 'lost', color: '#6B7280', position: 8, is_final_positive: false, is_final_negative: true },
    ],
  },
];

export const NICHE_LABELS: Record<NicheType, string> = {
  generic: 'Genérico',
  clinic: 'Clínica / Saúde',
  construction: 'Construção / Obras',
  telecom: 'Telecomunicações',
  ecommerce: 'E-commerce',
  real_estate: 'Imobiliário',
};

export function getNicheTemplate(niche: NicheType): NicheTemplate {
  return NICHE_TEMPLATES.find(t => t.id === niche) || NICHE_TEMPLATES[0];
}
