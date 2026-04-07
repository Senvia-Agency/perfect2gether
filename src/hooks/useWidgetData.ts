import { useMemo } from "react";
import { useLeads } from "@/hooks/useLeads";
import { useSales } from "@/hooks/useSales";
import { useProposals } from "@/hooks/useProposals";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useClients } from "@/hooks/useClients";
import { useEcommerceStats } from "@/hooks/ecommerce/useEcommerceStats";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { WidgetType } from "@/lib/dashboard-templates";
import { startOfDay, startOfWeek, endOfWeek, isToday, isThisWeek, subDays, format } from "date-fns";

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

  return useMemo(() => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    // Calculate lead trends (last 7 days)
    const calculateLeadTrend = () => {
      const last7Days = leads.filter(l => 
        new Date(l.created_at || '') >= subDays(today, 7)
      ).length;
      const prev7Days = leads.filter(l => {
        const date = new Date(l.created_at || '');
        return date >= subDays(today, 14) && date < subDays(today, 7);
      }).length;
      
      if (prev7Days === 0) return { value: 0, isPositive: true };
      const change = Math.round(((last7Days - prev7Days) / prev7Days) * 100);
      return { value: Math.abs(change), isPositive: change >= 0 };
    };

    // Generate chart data for last 7 days
    const generateLast7DaysChart = (items: Array<{ created_at?: string | null }>) => {
      const data: Array<{ name: string; value: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dayItems = items.filter(item => {
          const itemDate = new Date(item.created_at || '');
          return format(itemDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
        });
        data.push({
          name: format(date, 'EEE'),
          value: dayItems.length,
        });
      }
      return data;
    };

    switch (widgetType) {
      case 'leads_total': {
        const trend = calculateLeadTrend();
        return {
          value: leads.length.toString(),
          subtitle: 'leads captados',
          trend,
          chartData: generateLast7DaysChart(leads),
          isLoading: leadsLoading,
        };
      }

      case 'leads_trend': {
        const thisWeek = leads.filter(l => {
          const date = new Date(l.created_at || '');
          return date >= weekStart && date <= weekEnd;
        }).length;
        const trend = calculateLeadTrend();
        return {
          value: thisWeek.toString(),
          subtitle: 'esta semana',
          trend,
          chartData: generateLast7DaysChart(leads),
          isLoading: leadsLoading,
        };
      }

      case 'leads_by_source': {
        const sourceGroups = leads.reduce((acc, lead) => {
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
        const socialLeads = leads.filter(l => {
          const source = (l.source || '').toLowerCase();
          return SOCIAL_SOURCES.some(s => source.includes(s));
        });

        // Calculate trend for social leads
        const last7Days = socialLeads.filter(l => 
          new Date(l.created_at || '') >= subDays(today, 7)
        ).length;
        const prev7Days = socialLeads.filter(l => {
          const date = new Date(l.created_at || '');
          return date >= subDays(today, 14) && date < subDays(today, 7);
        }).length;
        
        const socialTrend = prev7Days === 0 
          ? { value: 0, isPositive: true }
          : { 
              value: Math.abs(Math.round(((last7Days - prev7Days) / prev7Days) * 100)),
              isPositive: (last7Days - prev7Days) >= 0 
            };

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
          trend: socialTrend,
          chartData,
          isLoading: leadsLoading,
        };
      }

      case 'leads_direct': {
        const SOCIAL_SOURCES = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube', 'social'];
        const directLeads = leads.filter(l => {
          const source = (l.source || '').toLowerCase();
          // Direto = sem fonte OU não é rede social
          return !source || !SOCIAL_SOURCES.some(s => source.includes(s));
        });

        // Calculate trend for direct leads
        const directLast7Days = directLeads.filter(l => 
          new Date(l.created_at || '') >= subDays(today, 7)
        ).length;
        const directPrev7Days = directLeads.filter(l => {
          const date = new Date(l.created_at || '');
          return date >= subDays(today, 14) && date < subDays(today, 7);
        }).length;
        
        const directTrend = directPrev7Days === 0 
          ? { value: 0, isPositive: true }
          : { 
              value: Math.abs(Math.round(((directLast7Days - directPrev7Days) / directPrev7Days) * 100)),
              isPositive: (directLast7Days - directPrev7Days) >= 0 
            };

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
          trend: directTrend,
          chartData,
          isLoading: leadsLoading,
        };
      }

      case 'conversion_rate': {
        // Use dynamic pipeline stages to find "won" leads
        const wonKey = stages.find(s => s.is_final_positive)?.key;
        const convertedLeads = leads.filter(l => {
          if (wonKey && l.status === wonKey) return true;
          const status = l.status?.toLowerCase() || '';
          return status === 'won' || status === 'converted' || status.includes('ganho') || status.includes('fechado');
        }).length;
        const rate = leads.length > 0 
          ? Math.round((convertedLeads / leads.length) * 100) 
          : 0;

        return {
          value: `${rate}%`,
          subtitle: `${convertedLeads} de ${leads.length} leads`,
          progress: rate,
          isLoading: leadsLoading,
        };
      }

      case 'sales_delivered': {
        const delivered = sales.filter(s => s.status === 'delivered');
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
        const open = proposals.filter(p => 
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
        const accepted = proposals.filter(p => p.status === 'accepted');
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
        const completed = sales.filter(s => s.status === 'delivered' || s.status === 'fulfilled');
        return {
          value: completed.length.toString(),
          subtitle: 'este mês',
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
        const closing = proposals.filter(p => p.status === 'sent');
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
        const thisMonth = sales.filter(s => {
          const date = new Date(s.created_at || '');
          return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        });
        const total = thisMonth.reduce((sum, s) => sum + (s.total_value || 0), 0);
        
        return {
          value: `€${total.toLocaleString('pt-PT')}`,
          subtitle: 'este mês',
          chartData: generateLast7DaysChart(thisMonth),
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
  }, [widgetType, leads, sales, proposals, events, clients, ecommerceStats, leadsLoading, salesLoading, proposalsLoading, eventsLoading, clientsLoading]);
}
