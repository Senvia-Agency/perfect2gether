import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CpeWithClient {
  id: string;
  equipment_type: string;
  serial_number: string | null;
  comercializador: string;
  fidelizacao_end: string;
  status: string;
  client_id: string;
  client_name: string;
  client_company: string | null;
  client_email: string | null;
  client_phone: string | null;
  days_until_expiry: number;
}

export interface FidelizationSettings {
  fidelization_alert_days: number[];
  fidelization_create_event: boolean;
  fidelization_event_time: string;
  fidelization_email_enabled: boolean;
  fidelization_email: string | null;
}

export function useFidelizationAlerts() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['fidelization-alerts', organizationId],
    queryFn: async () => {
      if (!organizationId) return { urgent: [], upcoming: [], expired: [] };

      // Get CPEs expiring within 30 days OR already expired, that haven't been resolved
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data: cpes, error } = await supabase
        .from('cpes')
        .select(`
          id,
          equipment_type,
          serial_number,
          comercializador,
          fidelizacao_end,
          status,
          client_id,
          renewal_status,
          crm_clients!inner(
            name,
            company,
            email,
            phone
          )
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .not('fidelizacao_end', 'is', null)
        .lte('fidelizacao_end', thirtyDaysFromNow.toISOString().split('T')[0])
        .order('fidelizacao_end', { ascending: true });

      if (error) {
        console.error('Error fetching fidelization alerts:', error);
        throw error;
      }

      const now = new Date();
      const results: CpeWithClient[] = (cpes || [])
        .filter((cpe: any) => !cpe.renewal_status || cpe.renewal_status === 'pending')
        .map((cpe: any) => {
          const expiryDate = new Date(cpe.fidelizacao_end);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
          return {
            id: cpe.id,
            equipment_type: cpe.equipment_type,
            serial_number: cpe.serial_number,
            comercializador: cpe.comercializador,
            fidelizacao_end: cpe.fidelizacao_end,
            status: cpe.status,
            client_id: cpe.client_id,
            client_name: cpe.crm_clients.name,
            client_company: cpe.crm_clients.company,
            client_email: cpe.crm_clients.email,
            client_phone: cpe.crm_clients.phone,
            days_until_expiry: daysUntilExpiry,
          };
        });

      // Split into expired (<=0 days), urgent (1-7 days) and upcoming (8-30 days)
      const expired = results.filter(cpe => cpe.days_until_expiry <= 0);
      const urgent = results.filter(cpe => cpe.days_until_expiry > 0 && cpe.days_until_expiry <= 7);
      const upcoming = results.filter(cpe => cpe.days_until_expiry > 7);

      return { urgent, upcoming, expired };
    },
    enabled: !!organizationId,
  });
}

export function useFidelizationSettings() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['fidelization-settings', organizationId],
    queryFn: async (): Promise<FidelizationSettings> => {
      if (!organizationId) {
        return {
          fidelization_alert_days: [30, 7],
          fidelization_create_event: true,
          fidelization_event_time: '10:00',
          fidelization_email_enabled: false,
          fidelization_email: null,
        };
      }

      const { data, error } = await supabase
        .from('organizations')
        .select('fidelization_alert_days, fidelization_create_event, fidelization_event_time, fidelization_email_enabled, fidelization_email')
        .eq('id', organizationId)
        .single();

      if (error) {
        console.error('Error fetching fidelization settings:', error);
        throw error;
      }

      return {
        fidelization_alert_days: (data.fidelization_alert_days as number[]) || [30, 7],
        fidelization_create_event: data.fidelization_create_event ?? true,
        fidelization_event_time: data.fidelization_event_time || '10:00',
        fidelization_email_enabled: data.fidelization_email_enabled ?? false,
        fidelization_email: data.fidelization_email,
      };
    },
    enabled: !!organizationId,
  });
}

export function useUpdateFidelizationSettings() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<FidelizationSettings>) => {
      if (!organization?.id) throw new Error('No organization');

      const { error } = await supabase
        .from('organizations')
        .update(settings)
        .eq('id', organization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fidelization-settings'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
  });
}
