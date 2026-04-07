import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProposalValue {
  lead_id: string | null;
  total_value: number;
  status: string;
}

export function useLeadProposalValues() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['lead-proposal-values', organizationId],
    queryFn: async () => {
      if (!organizationId) return new Map<string, number>();

      const { data, error } = await supabase
        .from('proposals')
        .select('lead_id, total_value, status')
        .eq('organization_id', organizationId)
        .not('lead_id', 'is', null);

      if (error) throw error;

      // Aggregate values by lead_id, excluding rejected proposals
      const valueMap = new Map<string, number>();
      
      (data as ProposalValue[]).forEach((proposal) => {
        if (proposal.lead_id && proposal.status !== 'rejected') {
          const currentValue = valueMap.get(proposal.lead_id) || 0;
          valueMap.set(proposal.lead_id, currentValue + (proposal.total_value || 0));
        }
      });

      return valueMap;
    },
    enabled: !!organizationId,
  });
}
