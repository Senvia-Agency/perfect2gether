import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SupportTicket {
  id: string;
  ticket_code: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

export function useSupportTickets() {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support-tickets', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, ticket_code, subject, description, status, priority, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SupportTicket[];
    },
    enabled: !!orgId,
  });

  return { tickets, isLoading };
}
