import { useMemo } from "react";
import { useLeads } from "@/hooks/useLeads";
import { useSales } from "@/hooks/useSales";
import { useProposals } from "@/hooks/useProposals";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useClients } from "@/hooks/useClients";
import { useEcommerceStats } from "@/hooks/ecommerce/useEcommerceStats";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useDashboardPeriod } from "@/stores/useDashboardPeriod";
import { WidgetType } from "@/lib/dashboard-templates";
import { getSaleCommission, isConcludedCommissionSale, sumConcludedCommissions } from "@/lib/monthly-commissions";
import { addDays, endOfDay, endOfMonth, format, isThisWeek, isToday, parseISO, startOfMonth, subMonths } from "date-fns";

export interface WidgetData {
  value: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  chartData?: Array<{ name: string; value: number }>;
  progress?: number;
  isLoading: boolean;
}

export function useWidgetData(widgetType: WidgetType): WidgetData {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: sales = [], isLoading: salesLoading } = useSales();
  const { data: proposals = [], isLoading: proposalsLoading } = useProposals();
  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const ecommerceStats = useEcommerceStats();
  const { data: stages = [] } = usePipelineStages();
  const { selectedMonth } = useDashboardPeriod();

  return useMemo(() => {
    const selectedMonthStart = startOfMonth(selectedMonth);
    const selectedMonthEnd = endOfMonth(selectedMonth);
    const selectedMonthLabel = format(selectedMonthStart, 'MMMM yyyy');

    const parseDashboardDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : new Date(value);
    const isInSelectedMonth = (value?: string | null) => {
      if (!value) return false;
      const date = parseDashboardDate(value);
      return !Number.isNaN(date.getTime()) && date >= selectedMonthStart && date <= selectedMonthEnd;
    };

    const periodLeads = leads.filter(lead => isInSelectedMonth(lead.created_at));
    const periodProposals = proposals.filter(proposal => isInSelectedMonth(proposal.created_at));
    const periodSales = sales.filter(sale => isInSelectedMonth(sale.sale_date || sale.created_at));

    // Calculate lead trends (last 7 days)
    const calculateLeadTrend = () => {
      const previousMonth = subMonths(selectedMonthStart, 1);
      const previousMonthStart = startOfMonth(previousMonth);
      const previousMonthEnd = endOfMonth(previousMonth);
      const lastMonth = leads.filter(l => {
        const date = new Date(l.created_at || '');
        return !Number.isNaN(date.getTime()) && date >= previousMonthStart && date <= previousMonthEnd;
      }).length;
      const last7Days = periodLeads.length;
      
      if (lastMonth === 0) return { value: 0, isPositive: true };
      const change = Math.round(((last7Days - lastMonth) / lastMonth) * 100);
      return { value: Math.abs(change), isPositive: change >= 0 };
    };

    // Four weekly buckets for the month selected in the dashboard filter.
    const generateLast7DaysChart = <T extends { created_at?: string | null; sale_date?: string | null }>(
      items: T[], valueOf: (item: T) => number = () => 1,
    ) => {
      const data: Array<{ name: string; value: number }> = [];
      for (let i = 0; i < 4; i++) {
        const date = addDays(selectedMonthStart, i * 7);
        const bucketEnd = i === 3 ? selectedMonthEnd : endOfDay(addDays(date, 6));
        const dayItems = items.filter(item => {
          const itemDate = parseDashboardDate(item.sale_date || item.created_at || '');
          return !Number.isNaN(itemDate.getTime()) && itemDate >= date && itemDate <= bucketEnd;
        });
        data.push({
          name: format(date, 'd MMM'),
          value: dayItems.reduce((sum, item) => sum + valueOf(item), 0),
        });
      }
      return data;
    };

    switch (widgetType) {
      case 'leads_total': {
        const trend = calculateLeadTrend();
        return {
          value: periodLeads.length.toString(),
          subtitle: 'leads captados',
          trend,
          chartData: generateLast7DaysChart(periodLeads),
          isLoading: leadsLoading,
        };
      }

      case 'leads_trend': {
        const trend = calculateLeadTrend();
        return {
          value: periodLeads.length.toString(),
          subtitle: selectedMonthLabel,
          trend,
          chartData: generateLast7DaysChart(periodLeads),
          isLoading: leadsLoading,
        };
      }

      case 'leads_by_source': {
        const sourceGroups = periodLeads.reduce((acc, lead) => {
          const source = lead.source || 'Directo';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const chartData = Object.entries(sourceGroups).map(([name, value]) => ({
          name,
          value,
        }));

        return {
          value: Object.keys(sourceGroups).length.toString(),
          subtitle: 'canais activos',
          chartData,
          isLoading: leadsLoading,
        };
      }

      case 'leads_social': {
        const SOCIAL_SOURCES = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube', 'social'];
        const socialLeads = periodLeads.filter(l => {
          const source = (l.source || '').toLowerCase();
          return SOCIAL_SOURCES.some(s => source.includes(s));
        });

        // Calculate trend for social leads
        const sourceGroups = socialLeads.reduce((acc, lead) => {
          const source = lead.source || 'Redes Sociais';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const chartData = Object.entries(sourceGroups).map(([name, value]) => ({
          name,
          value,
        }));

        return {
          value: socialLeads.length.toString(),
          subtitle: 'via redes sociais',
          chartData,
          isLoading: leadsLoading,
        };
      }

      case 'leads_direct': {
        const SOCIAL_SOURCES = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube', 'social'];
        const directLeads = periodLeads.filter(l => {
          const source = (l.source || '').toLowerCase();
          // Direto = sem fonte OU não é rede social
          return !source || !SOCIAL_SOURCES.some(s => source.includes(s));
        });

        // Calculate trend for direct leads
        const sourceGroups = directLeads.reduce((acc, lead) => {
          const source = lead.source || 'Directo';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const chartData = Object.entries(sourceGroups).map(([name, value]) => ({
          name,
          value,
        }));

        return {
          value: directLeads.length.toString(),
          subtitle: 'canais diretos',
          chartData,
          isLoading: leadsLoading,
        };
      }

      case 'conversion_rate': {
        // Use dynamic pipeline stages to find "won" leads
        const wonKey = stages.find(s => s.is_final_positive)?.key;
        const convertedLeads = periodLeads.filter(l => {
          if (wonKey && l.status === wonKey) return true;
          const status = l.status?.toLowerCase() || '';
          return status === 'won' || status === 'converted' || status.includes('ganho') || status.includes('fechado');
        }).length;
        const rate = periodLeads.length > 0
          ? Math.round((convertedLeads / periodLeads.length) * 100)
          : 0;

        return {
          value: `${rate}%`,
          subtitle: `${convertedLeads} de ${periodLeads.length} leads`,
          progress: rate,
          isLoading: leadsLoading,
        };
      }

      // Quantidade + valor por estado. Leads usam o campo 'value'; vendas o 'total_value'.
      case 'leads_scheduled':
      case 'leads_won':
      case 'leads_lost': {
        const statusByWidget = {
          leads_scheduled: 'scheduled',
          leads_won: 'won',
          leads_lost: 'lost',
        } as const;
        const target = statusByWidget[widgetType as keyof typeof statusByWidget];
        const filtered = periodLeads.filter(l => l.status === target);
        const totalValue = filtered.reduce((sum, l) => sum + (Number(l.value) || 0), 0);

        return {
          value: filtered.length.toString(),
          subtitle: `€${totalValue.toLocaleString('pt-PT')} total`,
          chartData: generateLast7DaysChart(filtered),
          isLoading: leadsLoading,
        };
      }

      case 'sales_fulfilled':
      case 'sales_in_progress': {
        const target = widgetType === 'sales_fulfilled' ? 'fulfilled' : 'in_progress';
        const filtered = periodSales.filter(s => s.status === target);
        const totalValue = filtered.reduce((sum, s) => sum + (s.total_value || 0), 0);

        return {
          value: filtered.length.toString(),
          subtitle: `€${totalValue.toLocaleString('pt-PT')} total`,
          chartData: generateLast7DaysChart(filtered),
          isLoading: salesLoading,
        };
      }

      case 'sales_delivered': {
        const delivered = periodSales.filter(s => s.status === 'delivered');
        const totalValue = delivered.reduce((sum, s) => sum + (s.total_value || 0), 0);

        return {
          value: delivered.length.toString(),
          subtitle: `€${totalValue.toLocaleString('pt-PT')} total`,
          chartData: generateLast7DaysChart(delivered),
          isLoading: salesLoading,
        };
      }

      case 'sales_active': {
        const active = sales.filter(s => 
          s.status === 'in_progress' || s.status === 'fulfilled'
        );
        const totalValue = active.reduce((sum, s) => sum + (s.total_value || 0), 0);

        return {
          value: active.length.toString(),
          subtitle: `€${totalValue.toLocaleString('pt-PT')} em pipeline`,
          chartData: generateLast7DaysChart(active),
          isLoading: salesLoading,
        };
      }

      case 'proposals_open': {
        const open = periodProposals.filter(p =>
          p.status === 'draft' || p.status === 'sent' || p.status === 'negotiating'
        );
        const totalValue = open.reduce((sum, p) => sum + (p.total_value || 0), 0);

        return {
          value: open.length.toString(),
          subtitle: `€${totalValue.toLocaleString('pt-PT')} pendente`,
          isLoading: proposalsLoading,
        };
      }

      case 'proposals_accepted': {
        const accepted = periodProposals.filter(p => p.status === 'accepted');
        const totalValue = accepted.reduce((sum, p) => sum + (p.total_value || 0), 0);

        return {
          value: accepted.length.toString(),
          subtitle: `€${totalValue.toLocaleString('pt-PT')} aceite`,
          isLoading: proposalsLoading,
        };
      }

      case 'appointments_today': {
        const todayEvents = events.filter(e => isToday(new Date(e.start_time)));
        const completedToday = todayEvents.filter(e => e.status === 'completed').length;

        return {
          value: todayEvents.length.toString(),
          subtitle: `${completedToday} concluídas`,
          progress: todayEvents.length > 0 
            ? Math.round((completedToday / todayEvents.length) * 100) 
            : 0,
          isLoading: eventsLoading,
        };
      }

      case 'patients_in_treatment':
      case 'active_customers': {
        const activeClients = clients.filter(c => c.status === 'active');
        return {
          value: activeClients.length.toString(),
          subtitle: 'clientes activos',
          chartData: generateLast7DaysChart(clients),
          isLoading: clientsLoading,
        };
      }

      case 'treatments_completed':
      case 'completed_projects': {
        const completed = periodSales.filter(s => s.status === 'delivered' || s.status === 'fulfilled');
        return {
          value: completed.length.toString(),
          subtitle: selectedMonthLabel,
          chartData: generateLast7DaysChart(completed),
          isLoading: salesLoading,
        };
      }

      case 'active_projects': {
        const active = sales.filter(s => 
          s.status === 'in_progress' || s.status === 'fulfilled'
        );
        return {
          value: active.length.toString(),
          subtitle: 'em execução',
          chartData: generateLast7DaysChart(active),
          isLoading: salesLoading,
        };
      }

      case 'pending_quotes': {
        const pending = proposals.filter(p => 
          p.status === 'draft' || p.status === 'sent'
        );
        return {
          value: pending.length.toString(),
          subtitle: 'aguardando resposta',
          isLoading: proposalsLoading,
        };
      }

      case 'visits_this_week': {
        const weekEvents = events.filter(e => isThisWeek(new Date(e.start_time), { weekStartsOn: 1 }));
        return {
          value: weekEvents.length.toString(),
          subtitle: 'agendadas',
          chartData: weekEvents.slice(0, 7).map(e => ({
            name: format(new Date(e.start_time), 'EEE'),
            value: 1,
          })),
          isLoading: eventsLoading,
        };
      }

      case 'active_listings': {
        // Use products or a specific field for listings
        return {
          value: clients.filter(c => c.status === 'active').length.toString(),
          subtitle: 'disponíveis',
          isLoading: clientsLoading,
        };
      }

      case 'deals_closing': {
        const closing = periodProposals.filter(p => p.status === 'sent');
        return {
          value: closing.length.toString(),
          subtitle: 'em negociação',
          isLoading: proposalsLoading,
        };
      }

      case 'pending_installations': {
        const pending = sales.filter(s => s.status === 'in_progress');
        return {
          value: pending.length.toString(),
          subtitle: 'aguardando instalação',
          isLoading: salesLoading,
        };
      }

      case 'monthly_commissions': {
        // Only concluded sales earn commission. For energy, use the CPE-based
        // amount resolved by useSales instead of a stale sale-level figure.
        const concludedSales = periodSales.filter(isConcludedCommissionSale);
        const total = sumConcludedCommissions(concludedSales);
        
        return {
          value: `€${total.toLocaleString('pt-PT')}`,
          subtitle: selectedMonthLabel,
          chartData: generateLast7DaysChart<(typeof concludedSales)[number]>(concludedSales, getSaleCommission),
          isLoading: salesLoading,
        };
      }

      case 'orders_today': {
        return {
          value: ecommerceStats.data?.total_orders?.toString() || '0',
          subtitle: 'encomendas totais',
          isLoading: ecommerceStats.isLoading,
        };
      }

      case 'revenue_today': {
        return {
          value: `€${(ecommerceStats.data?.total_revenue || 0).toLocaleString('pt-PT')}`,
          subtitle: 'faturação total',
          isLoading: ecommerceStats.isLoading,
        };
      }

      case 'low_stock_products': {
        return {
          value: ecommerceStats.data?.low_stock_products?.toString() || '0',
          subtitle: 'produtos com stock baixo',
          isLoading: ecommerceStats.isLoading,
        };
      }

      default:
        return {
          value: '0',
          subtitle: 'dados indisponíveis',
          isLoading: false,
        };
    }
  }, [widgetType, leads, sales, proposals, events, clients, ecommerceStats, leadsLoading, salesLoading, proposalsLoading, eventsLoading, clientsLoading, selectedMonth]);
}
