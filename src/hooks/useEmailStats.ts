import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { subDays, format } from 'date-fns';

type Period = '7d' | '30d' | '90d';
type SourceFilter = 'all' | 'campaign' | 'automation';

function getPeriodStart(period: Period): string {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return subDays(new Date(), days).toISOString();
}

export function useEmailStats(
  period: Period = '30d',
  source: SourceFilter = 'all',
  sourceId?: string | null,
) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['email-stats', organizationId, period, source, sourceId],
    queryFn: async () => {
      if (!organizationId) return null;

      const periodStart = getPeriodStart(period);

      let query = supabase
        .from('email_sends')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('created_at', periodStart);

      if (source === 'campaign') {
        if (sourceId) {
          query = query.eq('campaign_id', sourceId);
        } else {
          query = query.not('campaign_id', 'is', null);
        }
      } else if (source === 'automation') {
        // automation_id is a new column not yet in generated types, use raw filter
        if (sourceId) {
          query = query.filter('automation_id', 'eq', sourceId);
        } else {
          query = query.filter('automation_id', 'not.is', null);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data.length;
      const sent = data.filter(d => d.status === 'sent' || d.status === 'delivered' || d.status === 'opened' || d.status === 'clicked').length;
      const delivered = data.filter(d => ['delivered', 'opened', 'clicked'].includes(d.status)).length;
      const failed = data.filter(d => d.status === 'failed').length;
      const opened = data.filter(d => d.opened_at).length;
      const clicked = data.filter(d => d.clicked_at).length;
      const bounced = data.filter(d => d.status === 'bounced').length;
      const spam = data.filter(d => d.status === 'spam').length;
      const blocked = data.filter(d => d.status === 'blocked').length;
      const unsubscribed = data.filter(d => d.status === 'unsubscribed').length;

      // Group by day for chart
      const dailyMap = new Map<string, { sent: number; delivered: number; failed: number; opened: number; clicked: number }>();
      
      data.forEach(item => {
        const day = format(new Date(item.created_at), 'yyyy-MM-dd');
        if (!dailyMap.has(day)) {
          dailyMap.set(day, { sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 });
        }
        const entry = dailyMap.get(day)!;
        if (['sent', 'delivered', 'opened', 'clicked'].includes(item.status)) entry.sent++;
        if (['delivered', 'opened', 'clicked'].includes(item.status)) entry.delivered++;
        if (item.status === 'failed') entry.failed++;
        if (item.opened_at) entry.opened++;
        if (item.clicked_at) entry.clicked++;
      });

      const daily = Array.from(dailyMap.entries())
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        total,
        sent,
        delivered,
        failed,
        opened,
        clicked,
        bounced,
        spam,
        blocked,
        unsubscribed,
        deliveredRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
        daily,
        events: data,
      };
    },
    enabled: !!organizationId,
  });
}
