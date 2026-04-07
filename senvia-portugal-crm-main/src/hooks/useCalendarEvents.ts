import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamFilter } from '@/hooks/useTeamFilter';
import { toast } from 'sonner';
import type { CalendarEvent, EventType, EventStatus } from '@/types/calendar';

interface CreateEventParams {
  title: string;
  description?: string;
  event_type: EventType;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  lead_id?: string;
  reminder_minutes?: number | null;
  meeting_link?: string;
}

interface UpdateEventParams {
  id: string;
  title?: string;
  description?: string;
  event_type?: EventType;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  lead_id?: string | null;
  status?: EventStatus;
  reminder_minutes?: number | null;
  meeting_link?: string | null;
}

export function useCalendarEvents(startDate?: Date, endDate?: Date) {
  const { organization } = useAuth();
  const { effectiveUserId } = useTeamFilter();

  return useQuery({
    queryKey: ['calendar-events', organization?.id, effectiveUserId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from('calendar_events')
        .select(`
          *,
          lead:leads(id, name)
        `)
        .eq('organization_id', organization.id)
        .order('start_time', { ascending: true });

      if (effectiveUserId) {
        query = query.eq('user_id', effectiveUserId);
      }

      if (startDate) {
        query = query.gte('start_time', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('start_time', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching calendar events:', error);
        throw error;
      }

      const events = data || [];
      const uniqueUserIds = [...new Set(events.map((event) => event.user_id).filter(Boolean))];

      let profilesById = new Map<string, { id: string; full_name: string | null }>();

      if (uniqueUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueUserIds);

        if (profilesError) {
          console.error('Error fetching event users:', profilesError);
        } else {
          profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
        }
      }

      return events.map((event) => ({
        ...event,
        user: profilesById.get(event.user_id) || null,
      })) as CalendarEvent[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { user, organization } = useAuth();

  return useMutation({
    mutationFn: async (params: CreateEventParams) => {
      if (!user?.id || !organization?.id) {
        throw new Error('User or organization not found');
      }

      // 1. Criar o evento
      const { data: eventData, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          ...params,
          user_id: user.id,
          organization_id: organization.id,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      return eventData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['lead-events'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Evento criado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating event:', error);
      toast.error('Erro ao criar evento');
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...params }: UpdateEventParams) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(params)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['lead-events'] });
      toast.success('Evento atualizado com sucesso');
    },
    onError: (error) => {
      console.error('Error updating event:', error);
      toast.error('Erro ao atualizar evento');
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['lead-events'] });
      toast.success('Evento eliminado com sucesso');
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
      toast.error('Erro ao eliminar evento');
    },
  });
}
