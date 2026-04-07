import { ClipboardCheck, Plus, Search, Users, type LucideIcon } from "lucide-react";

export type PortalTotalLinkSectionKey = "home" | "contratos" | "ids" | "pendentes" | "reclamacoes" | "rh";

export interface PortalTotalLinkSectionAction {
  label: string;
  icon: LucideIcon;
}

export interface PortalTotalLinkSection {
  key: PortalTotalLinkSectionKey;
  label: string;
  path: string;
  title: string;
  description: string;
  action?: PortalTotalLinkSectionAction;
}

export const portalTotalLinkSections: PortalTotalLinkSection[] = [
  {
    key: "home",
    label: "Home",
    path: "/portal-total-link/home",
    title: "Home",
    description: "",
  },
  {
    key: "contratos",
    label: "Contratos",
    path: "/portal-total-link/contratos",
    title: "Contratos",
    description: "Área pronta para gestão e consulta de contratos do Portal Total Link.",
    action: {
      label: "Adicionar",
      icon: Plus,
    },
  },
  {
    key: "ids",
    label: "ID´s",
    path: "/portal-total-link/ids",
    title: "ID´s",
    description: "Secção dedicada à revisão e organização de identificadores operacionais.",
    action: {
      label: "Revisão",
      icon: ClipboardCheck,
    },
  },
  {
    key: "pendentes",
    label: "Pendentes",
    path: "/portal-total-link/pendentes",
    title: "Pendentes",
    description: "Painel preparado para monitorizar tarefas, bloqueios e seguimentos pendentes.",
    action: {
      label: "Pesquisar",
      icon: Search,
    },
  },
  {
    key: "reclamacoes",
    label: "Reclamações",
    path: "/portal-total-link/reclamacoes",
    title: "Reclamações",
    description: "Espaço para registo e acompanhamento de reclamações em modo isolado.",
    action: {
      label: "Adicionar",
      icon: Plus,
    },
  },
  {
    key: "rh",
    label: "RH",
    path: "/portal-total-link/rh",
    title: "Recursos Humanos",
    description: "Gestão de férias, ausências e presenças da equipa.",
    action: {
      label: "Marcar",
      icon: Users,
    },
  },
];

export const portalTotalLinkCycleOptions = [
  { value: "all", label: "Todos os ciclos" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
];

const currentYear = new Date().getFullYear();

export const portalTotalLinkHomeCycleOptions = Array.from({ length: 13 }, (_, index) => {
  const cycle = String(index + 1);

  return { value: cycle, label: `Ciclo ${cycle}` };
});

export const portalTotalLinkHomeYearOptions = Array.from({ length: 5 }, (_, index) => {
  const year = String(currentYear - 2 + index);

  return { value: year, label: year };
});

export const portalTotalLinkYearOptions = [
  { value: "all", label: "Todos os anos" },
  ...Array.from({ length: 7 }, (_, index) => {
    const year = String(currentYear + 1 - index);

    return { value: year, label: year };
  }),
];

export const portalTotalLinkCommercialStatusOptions = [
  { value: "all", label: "Todos os estados comerciais" },
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "negociacao", label: "Negociação" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export const portalTotalLinkBoStatusOptions = [
  { value: "all", label: "Todos os estados BO" },
  { value: "por_iniciar", label: "Por iniciar" },
  { value: "em_processo", label: "Em processo" },
  { value: "aguarda_cliente", label: "Aguarda cliente" },
  { value: "resolvido", label: "Resolvido" },
  { value: "fechado", label: "Fechado" },
];
