import { Building, UsersRound, Package, Link2, Receipt, GitBranch, LayoutGrid, FileText, List, KeyRound, UserCog, Network, Calculator, ShoppingCart, LifeBuoy, BellRing } from "lucide-react";
import { SettingsCard } from "./SettingsCard";

export type SettingsSection = "general" | "team" | "products" | "finance" | "integrations" | "support";

export type SettingsSubSection =
  | "org-general" | "org-pipeline" | "org-modules" | "org-forms" | "org-fields" | "org-sales" | "org-matrix" | "org-push"
  | "team-access" | "team-profiles" | "team-teams"
  | "products"
  | "finance-expenses" | "finance-fiscal"
  | "integrations"
  | "support-tickets";

interface MobileSettingsNavProps {
  activeSection: SettingsSection | null;
  onSelectSection: (section: SettingsSection) => void;
  canManageTeam: boolean;
  canManageIntegrations: boolean;
  isAdmin?: boolean;
  isTelecom?: boolean;
}

interface SectionItem {
  id: SettingsSection;
  label: string;
  icon: any;
  description: string;
  requiresTeam?: boolean;
  requiresIntegrations?: boolean;
  requiresAdmin?: boolean;
}

const sections: SectionItem[] = [
  { id: "general", label: "Definições Gerais", icon: Building, description: "Organização, pipeline e formulários", requiresAdmin: true },
  { id: "team", label: "Equipa e Acessos", icon: UsersRound, description: "Colaboradores, perfis e equipas", requiresTeam: true },
  { id: "products", label: "Produtos", icon: Package, description: "Catálogo de produtos", requiresIntegrations: true },
  { id: "finance", label: "Financeiro", icon: Receipt, description: "Despesas e configuração fiscal", requiresIntegrations: true },
  { id: "integrations", label: "Integrações", icon: Link2, description: "WhatsApp, email e faturação", requiresIntegrations: true },
  { id: "support", label: "Suporte", icon: LifeBuoy, description: "Tickets e pedidos de ajuda" },
];

export function MobileSettingsNav({
  activeSection,
  onSelectSection,
  canManageTeam,
  canManageIntegrations,
  isAdmin = false,
  isTelecom = false,
}: MobileSettingsNavProps) {
  const visibleSections = sections.filter(item => {
    if (item.requiresAdmin && !isAdmin) return false;
    if (item.requiresTeam && !canManageTeam) return false;
    if (item.requiresIntegrations && !canManageIntegrations) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {visibleSections.map((section) => (
        <SettingsCard
          key={section.id}
          icon={section.icon}
          title={section.label}
          description={section.description}
          onClick={() => onSelectSection(section.id)}
        />
      ))}
    </div>
  );
}

// Sub-section definitions per group
export interface SubSectionItem {
  id: SettingsSubSection;
  label: string;
  icon: any;
  description: string;
}

export const subSectionsMap: Record<SettingsSection, SubSectionItem[]> = {
  general: [
    { id: "org-general", label: "Geral", icon: Building, description: "Nome, logotipo e dados" },
    { id: "org-pipeline", label: "Pipeline", icon: GitBranch, description: "Etapas do funil de vendas" },
    { id: "org-modules", label: "Módulos", icon: LayoutGrid, description: "Funcionalidades ativas" },
    { id: "org-forms", label: "Formulário", icon: FileText, description: "Captação de leads" },
    { id: "org-fields", label: "Campos", icon: List, description: "Campos por módulo (Leads, Clientes, etc.)" },
    { id: "org-sales", label: "Vendas", icon: ShoppingCart, description: "Regras de vendas" },
    { id: "org-matrix", label: "Matriz Comissões", icon: Calculator, description: "Cálculo automático de comissões" },
    { id: "org-push", label: "Notificações Push", icon: BellRing, description: "Ativar alertas no seu dispositivo" },
  ],
  team: [
    { id: "team-access", label: "Acessos", icon: KeyRound, description: "Convites e permissões" },
    { id: "team-profiles", label: "Perfis", icon: UserCog, description: "Níveis de acesso" },
    { id: "team-teams", label: "Equipas", icon: Network, description: "Hierarquia e líderes" },
  ],
  products: [],
  finance: [
    { id: "finance-expenses", label: "Tipos de Despesas", icon: Receipt, description: "Categorias de despesas" },
    { id: "finance-fiscal", label: "Fiscal", icon: Calculator, description: "IVA e configuração fiscal" },
  ],
  integrations: [],
  support: [],
};

interface MobileSubSectionNavProps {
  group: SettingsSection;
  onSelectSubSection: (sub: SettingsSubSection) => void;
  isTelecom?: boolean;
}

export function MobileSubSectionNav({ group, onSelectSubSection, isTelecom = false }: MobileSubSectionNavProps) {
  const allItems = subSectionsMap[group];
  const items = allItems.filter(item => {
    if (item.id === 'notif-alerts' && !isTelecom) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => (
        <SettingsCard
          key={item.id}
          icon={item.icon}
          title={item.label}
          description={item.description}
          onClick={() => onSelectSubSection(item.id)}
        />
      ))}
    </div>
  );
}

// Groups that go directly to content (no sub-sections)
export const directContentGroups: SettingsSection[] = ["products", "integrations", "support"];

// Section titles
export const sectionTitles: Record<SettingsSection, string> = {
  general: "Definições Gerais",
  team: "Equipa e Acessos",
  products: "Produtos",
  finance: "Financeiro",
  integrations: "Integrações",
  support: "Suporte",
};
