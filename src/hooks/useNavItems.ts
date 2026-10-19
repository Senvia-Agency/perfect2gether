import { useReleaseFeatures } from './useReleaseFeatures';
import { groupNavigationItems } from '@/lib/navigation-groups';
import { useUnreadMessages } from '@/modules/messages/useUnreadMessages';
import type { ElementType } from 'react';
import {
  LayoutDashboard, Users, UserCheck, FileText, ShoppingBag,
  Wallet, Calendar, Mail, Search, Store, Settings, BarChart3,
  Building2, UsersRound, MessagesSquare,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useModules, EnabledModules } from '@/hooks/useModules';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/hooks/useSubscription';

export interface NavItem {
  to: string;
  icon: ElementType;
  label: string;
  /** Rótulo curto para a barra inferior (mobile). Cai para `label` se ausente. */
  shortLabel?: string;
  moduleKey?: keyof EnabledModules;
  permissionKey?: string;
  isAdminOnly?: boolean;
  /** Módulo bloqueado pelo plano de subscrição (continua visível, com cadeado). */
  locked?: boolean;
  unread?: number;
}

const MAIN_NAV: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Painel' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/clients', icon: UserCheck, label: 'Clientes', moduleKey: 'clients' },
  { to: '/proposals', icon: FileText, label: 'Propostas', moduleKey: 'proposals' },
  { to: '/sales', icon: ShoppingBag, label: 'Vendas', moduleKey: 'sales' },
  { to: '/financeiro', icon: Wallet, label: 'Financeiro', shortLabel: 'Finanças', moduleKey: 'finance' },
  { to: '/calendar', icon: Calendar, label: 'Agenda', moduleKey: 'calendar' },
  { to: '/marketing', icon: Mail, label: 'Marketing', moduleKey: 'marketing' },
  { to: '/prospects', icon: Search, label: 'Prospects', moduleKey: 'prospects' },
  { to: '/ecommerce', icon: Store, label: 'E-commerce', shortLabel: 'Loja', moduleKey: 'ecommerce' },
  { to: '/messages', icon: MessagesSquare, label: 'Mensagens' },
  { to: '/rh', icon: UsersRound, label: 'Recursos Humanos', shortLabel: 'RH' },
  { to: '/settings', icon: Settings, label: 'Definições', isAdminOnly: true },
  { to: '/gestao', icon: BarChart3, label: 'Gestão', permissionKey: 'gestao' },
];

/**
 * Itens de navegação da app — FONTE ÚNICA.
 *
 * Usado pelo sidebar (desktop), pela barra inferior e pelo menu hambúrguer
 * (mobile). Devolve a lista já filtrada por módulos ativos, permissões, papel
 * e plano de subscrição — para que as três navegações nunca divirjam.
 */
export function useNavItems() {
  const { isSuperAdmin } = useAuth();
  const unread = useUnreadMessages();
  const { features } = useReleaseFeatures();
  const { modules } = useModules();
  const { isAdmin, canViewModule, systems } = usePermissions();
  const { isModuleLocked } = useSubscription();

  const isTotalLinkOnly = systems.length === 1 && systems[0] === 'total_link';

  // Utilizadores exclusivos do Total Link só veem o portal.
  if (isTotalLinkOnly) {
    const portalItems: NavItem[] = [{ to: '/portal-total-link', icon: Building2, label: 'Portal Total Link', shortLabel: 'Portal' }];
    return { items: portalItems, isTotalLinkOnly, ...groupNavigationItems(portalItems) };
  }

  const items: NavItem[] = MAIN_NAV
    .filter(item => {
      if (item.to === "/messages" && !features.messages) return false;
      if (item.isAdminOnly && !isAdmin && !isSuperAdmin) return false;
      if (item.permissionKey && !canViewModule(item.permissionKey)) return false;
      if (!item.moduleKey) return true;
      if (isModuleLocked(item.moduleKey)) return true; // bloqueado pelo plano: continua visível
      if (!modules[item.moduleKey]) return false;
      if (!canViewModule(item.moduleKey)) return false;
      return true;
    })
    .map(item => ({
      ...item,
      unread: item.to === '/messages' ? unread : undefined,
      locked: item.moduleKey ? isModuleLocked(item.moduleKey) : false,
    }));

  return { items, isTotalLinkOnly, ...groupNavigationItems(items) };
}
