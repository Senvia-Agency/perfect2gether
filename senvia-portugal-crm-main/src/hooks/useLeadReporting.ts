import { useMemo } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { useTeamMembers } from '@/hooks/useTeam';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, isWithinInterval } from 'date-fns';

export type ReportPeriod = 'week' | 'month' | 'quarter' | 'all';

function getPeriodInterval(period: ReportPeriod): { start: Date; end: Date } | null {
  const now = new Date();
  switch (period) {
    case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter': return { start: startOfQuarter(now), end: endOfMonth(now) };
    case 'all': return null;
  }
}

export interface CommercialReport {
  userId: string;
  name: string;
  total: number;
  byStage: Record<string, number>;
  conversionRate: number;
}

export function useLeadReporting(period: ReportPeriod) {
  const { data: leads = [] } = useLeads();
  const { data: stages = [] } = usePipelineStages();
  const { data: members = [] } = useTeamMembers();

  return useMemo(() => {
    const interval = getPeriodInterval(period);

    const filteredLeads = interval
      ? leads.filter(l => {
          const d = l.created_at ? new Date(l.created_at) : null;
          return d && isWithinInterval(d, interval);
        })
      : leads;

    const wonKey = stages.find(s => s.is_final_positive)?.key;
    const lostKey = stages.find(s => s.is_final_negative)?.key;

    // Global stats
    const totalLeads = filteredLeads.length;
    const totalWon = filteredLeads.filter(l => l.status === wonKey).length;
    const totalLost = filteredLeads.filter(l => l.status === lostKey).length;
    const globalConversion = totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0;

    // By source
    const bySource: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const src = l.source || 'Desconhecida';
      bySource[src] = (bySource[src] || 0) + 1;
    });

    // Per commercial
    const commercialMap = new Map<string, typeof filteredLeads>();
    filteredLeads.forEach(l => {
      const key = l.assigned_to || '__unassigned__';
      if (!commercialMap.has(key)) commercialMap.set(key, []);
      commercialMap.get(key)!.push(l);
    });

    const commercials: CommercialReport[] = [];

    commercialMap.forEach((cLeads, userId) => {
      const member = members.find(m => m.user_id === userId);
      const byStage: Record<string, number> = {};
      stages.forEach(s => {
        byStage[s.key] = cLeads.filter(l => l.status === s.key).length;
      });

      const won = cLeads.filter(l => l.status === wonKey).length;
      commercials.push({
        userId,
        name: member?.full_name || (userId === '__unassigned__' ? 'Não atribuído' : 'Desconhecido'),
        total: cLeads.length,
        byStage,
        conversionRate: cLeads.length > 0 ? Math.round((won / cLeads.length) * 100) : 0,
      });
    });

    commercials.sort((a, b) => b.total - a.total);

    return {
      totalLeads,
      totalWon,
      totalLost,
      globalConversion,
      bySource,
      commercials,
      stages,
    };
  }, [leads, stages, members, period]);
}
