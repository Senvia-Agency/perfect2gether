import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LeadEvent {
  id: string;
  title: string;
  start_time: string;
  event_type: string;
  lead_id: string;
}

export function useLeadEvents() {
  const { organization } = useAuth();

  return useQuery({
    queryKey: ['lead-events', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return {};

      // Get all non-cancelled/completed events for leads (past and future)
      // We'll pick the most relevant one per lead
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, start_time, event_type, lead_id')
        .eq('organization_id', organization.id)
        .not('lead_id', 'is', null)
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching lead events:', error);
        throw error;
      }

      const now = new Date();
      const eventsByLead: Record<string, LeadEvent> = {};
      const pastEventsByLead: Record<string, LeadEvent> = {};
      
      // First pass: separate future and past events
      for (const event of data || []) {
        if (!event.lead_id) continue;
        
        const eventDate = new Date(event.start_time);
        
        if (eventDate >= now) {
          // Future event - keep the earliest one
          if (!eventsByLead[event.lead_id]) {
            eventsByLead[event.lead_id] = event as LeadEvent;
          }
        } else {
          // Past event - keep the most recent one
          if (!pastEventsByLead[event.lead_id] || 
              new Date(pastEventsByLead[event.lead_id].start_time) < eventDate) {
            pastEventsByLead[event.lead_id] = event as LeadEvent;
          }
        }
      }

      // Second pass: for leads without future events, use their most recent past event
      for (const [leadId, event] of Object.entries(pastEventsByLead)) {
        if (!eventsByLead[leadId]) {
          eventsByLead[leadId] = event;
        }
      }

      return eventsByLead;
    },
    enabled: !!organization?.id,
  });
}
