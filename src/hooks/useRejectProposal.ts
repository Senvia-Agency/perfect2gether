import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { proposalRejectionSchema, type ProposalRejectionInput } from '@/lib/proposal-rejection';
import { toast } from 'sonner';

export function useRejectProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (command: { readonly proposalId: string; readonly form: ProposalRejectionInput; readonly leadStatus?: string }) => {
      const form = proposalRejectionSchema.parse(command.form);
      const { data, error } = await supabase.rpc('reject_p2g_proposal_with_meeting', {
        _proposal: command.proposalId,
        _reason: form.reason,
        _meeting: {
          start_time: new Date(form.start).toISOString(),
          end_time: new Date(form.end).toISOString(),
          meeting_link: form.meetingLink || null,
          ...(command.leadStatus ? { lead_status: command.leadStatus } : {}),
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      for (const key of ['proposals', 'calendar-events', 'lead-events', 'leads', 'metrics-proposals-ops', 'dashboard-stats']) {
        void client.invalidateQueries({ queryKey: [key] });
      }
      toast.success('Proposta recusada e reunião marcada');
    },
  });
}
