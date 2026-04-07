import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type TableName = 'leads' | 'proposals' | 'sales';

interface RealtimeConfig {
  table: TableName;
  queryKeys: string[][];
}

/**
 * Hook to subscribe to Supabase Realtime changes and invalidate React Query cache
 */
export function useRealtimeSubscription(configs: RealtimeConfig[]) {
  const queryClient = useQueryClient();
  const { organization } = useAuth();

  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `organization_id=eq.${organization.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['lead-proposal-values'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proposals',
          filter: `organization_id=eq.${organization.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['proposals'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['lead-proposal-values'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `organization_id=eq.${organization.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sales'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization?.id, queryClient]);
}

/**
 * Hook specifically for leads realtime updates
 */
export function useLeadsRealtime() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();

  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `organization_id=eq.${organization.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['lead-proposal-values'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization?.id, queryClient]);
}

/**
 * Hook specifically for proposals realtime updates
 */
export function useProposalsRealtime() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();

  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel('proposals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proposals',
          filter: `organization_id=eq.${organization.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['proposals'] });
          queryClient.invalidateQueries({ queryKey: ['lead-proposal-values'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization?.id, queryClient]);
}

/**
 * Hook specifically for sales realtime updates
 */
export function useSalesRealtime() {
  const queryClient = useQueryClient();
  const { organization } = useAuth();

  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel('sales-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `organization_id=eq.${organization.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sales'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization?.id, queryClient]);
}
