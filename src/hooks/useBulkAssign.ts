import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BulkAssignLeadsParams {
  leadIds: string[];
  assignedTo: string | null;
}

interface BulkAssignClientsParams {
  clientIds: string[];
  assignedTo: string | null;
}

export function useBulkAssignLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadIds, assignedTo }: BulkAssignLeadsParams) => {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: assignedTo })
        .in("id", leadIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useBulkAssignClients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientIds, assignedTo }: BulkAssignClientsParams) => {
      // 1. Update clients
      const { error } = await supabase
        .from("crm_clients")
        .update({ assigned_to: assignedTo })
        .in("id", clientIds);
      if (error) throw error;

      // 2. Get associated lead_ids
      const { data: clientRows } = await supabase
        .from("crm_clients")
        .select("lead_id")
        .in("id", clientIds)
        .not("lead_id", "is", null);

      const leadIds = (clientRows || []).map((r) => r.lead_id!).filter(Boolean);

      // 3. Update leads
      if (leadIds.length > 0) {
        await supabase
          .from("leads")
          .update({ assigned_to: assignedTo })
          .in("id", leadIds);
      }

      // 4. Update proposals
      if (assignedTo) {
        await supabase
          .from("proposals")
          .update({ created_by: assignedTo })
          .in("client_id", clientIds);
      }

      // 5. Update calendar events
      if (assignedTo) {
        await supabase
          .from("calendar_events")
          .update({ user_id: assignedTo })
          .in("client_id", clientIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
