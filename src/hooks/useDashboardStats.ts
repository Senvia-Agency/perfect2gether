import { useMemo } from "react";
import { useLeads } from "./useLeads";
import { useProposals } from "./useProposals";
import { useSales } from "./useSales";
import { startOfDay, subDays, format, parseISO, isWithinInterval } from "date-fns";

export function useDashboardStats() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: proposals = [], isLoading: proposalsLoading } = useProposals();
  const { data: sales = [], isLoading: salesLoading } = useSales();

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));

    // === VENDAS ===
    const deliveredSales = sales.filter(s => s.status === 'delivered');
    const activeSales = sales.filter(s => s.status === 'in_progress' || s.status === 'fulfilled');
    
    // Trend data for delivered sales (last 7 days)
    const deliveredTrend = last7Days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const count = deliveredSales.filter(s => {
        const saleDate = format(parseISO(s.updated_at), 'yyyy-MM-dd');
        return saleDate === dayStr;
      }).length;
      return { value: count, name: format(day, 'EEE') };
    });

    // Total value of delivered sales
    const deliveredValue = deliveredSales.reduce((sum, s) => sum + (s.total_value || 0), 0);
    const activeValue = activeSales.reduce((sum, s) => sum + (s.total_value || 0), 0);

    // Conversion rate: leads that became sales
    const totalLeads = leads.length;
    const leadsWithSales = new Set(sales.map(s => s.lead_id).filter(Boolean)).size;
    const conversionRate = totalLeads > 0 ? Math.round((leadsWithSales / totalLeads) * 100) : 0;

    // Propostas em aberto (draft, sent, negotiating)
    const openProposals = proposals.filter(p => 
      ['draft', 'sent', 'negotiating'].includes(p.status)
    );
    const openProposalsCount = openProposals.length;
    const openProposalsValue = openProposals.reduce((sum, p) => sum + (p.total_value || 0), 0);

    // Propostas em aberto por status
    const openByStatus = [
      { name: 'Rascunho', value: proposals.filter(p => p.status === 'draft').length },
      { name: 'Enviada', value: proposals.filter(p => p.status === 'sent').length },
      { name: 'Negociação', value: proposals.filter(p => p.status === 'negotiating').length },
    ];

    // Propostas aceites
    const acceptedProposals = proposals.filter(p => p.status === 'accepted');
    const acceptedProposalsValue = acceptedProposals.reduce((sum, p) => sum + (p.total_value || 0), 0);
    const acceptedProposalsCount = acceptedProposals.length;

    // Trend data for accepted proposals (last 7 days)
    const acceptedTrend = last7Days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = acceptedProposals.filter(p => {
        const propDate = parseISO(p.created_at);
        return isWithinInterval(propDate, { start: dayStart, end: dayEnd });
      }).length;
      return { value: count, name: format(day, 'EEE') };
    });

    // === ENTRADA ===
    // Total de leads e trend
    const leadsTrend = last7Days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = leads.filter(l => {
        const leadDate = parseISO(l.created_at || '');
        return isWithinInterval(leadDate, { start: dayStart, end: dayEnd });
      }).length;
      return { value: count, name: format(day, 'EEE') };
    });

    // Leads do site (source = website, direct, form, landing)
    const websiteSources = ['website', 'direct', 'form', 'landing', 'site'];
    const websiteLeads = leads.filter(l => 
      websiteSources.some(src => l.source?.toLowerCase().includes(src))
    );
    const websiteLeadsCount = websiteLeads.length;
    const websitePercentage = totalLeads > 0 ? Math.round((websiteLeadsCount / totalLeads) * 100) : 0;

    // Website leads by day
    const websiteTrend = last7Days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = websiteLeads.filter(l => {
        const leadDate = parseISO(l.created_at || '');
        return isWithinInterval(leadDate, { start: dayStart, end: dayEnd });
      }).length;
      return { value: count, name: format(day, 'EEE') };
    });

    // Leads das redes sociais
    const socialSources = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'social', 'meta'];
    const socialLeads = leads.filter(l => 
      socialSources.some(src => l.source?.toLowerCase().includes(src))
    );
    const socialLeadsCount = socialLeads.length;

    // Social leads by source
    const socialBySource: { name: string; value: number; color?: string }[] = [];
    const sourceColors: Record<string, string> = {
      instagram: 'hsl(328, 100%, 54%)',
      facebook: 'hsl(214, 89%, 52%)',
      linkedin: 'hsl(201, 100%, 35%)',
      tiktok: 'hsl(0, 0%, 0%)',
      twitter: 'hsl(203, 89%, 53%)',
    };

    socialSources.forEach(source => {
      const count = leads.filter(l => l.source?.toLowerCase().includes(source)).length;
      if (count > 0) {
        socialBySource.push({
          name: source.charAt(0).toUpperCase() + source.slice(1),
          value: count,
          color: sourceColors[source] || 'hsl(var(--primary))',
        });
      }
    });

    // Other social if any unmatched
    const otherSocial = socialLeadsCount - socialBySource.reduce((sum, s) => sum + s.value, 0);
    if (otherSocial > 0) {
      socialBySource.push({ name: 'Outros', value: otherSocial });
    }

    return {
      // Vendas
      deliveredSales: {
        count: deliveredSales.length,
        value: deliveredValue,
        trend: deliveredTrend,
      },
      activeSales: {
        count: activeSales.length,
        value: activeValue,
      },
      conversionRate,
      openProposals: {
        count: openProposalsCount,
        value: openProposalsValue,
        byStatus: openByStatus,
      },
      acceptedProposals: {
        count: acceptedProposalsCount,
        value: acceptedProposalsValue,
        trend: acceptedTrend,
      },
      // Entrada
      totalLeads: {
        count: totalLeads,
        trend: leadsTrend,
      },
      websiteLeads: {
        count: websiteLeadsCount,
        percentage: websitePercentage,
        trend: websiteTrend,
      },
      socialLeads: {
        count: socialLeadsCount,
        bySource: socialBySource,
      },
    };
  }, [leads, proposals, sales]);

  return {
    ...stats,
    isLoading: leadsLoading || proposalsLoading || salesLoading,
  };
}
