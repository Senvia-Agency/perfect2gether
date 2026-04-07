import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useClientProposalTypes() {
  const { organization } = useAuth();
  const isTelecom = organization?.niche === 'telecom';

  const { data: clientTypesMap = {} } = useQuery({
    queryKey: ['client-proposal-types', organization?.id],
    enabled: !!organization?.id && isTelecom,
    queryFn: async () => {
      // Fetch distinct proposal_type per client_id from proposals
      const { data: proposalRows } = await supabase
        .from('proposals')
        .select('client_id, proposal_type')
        .eq('organization_id', organization!.id)
        .not('client_id', 'is', null)
        .not('proposal_type', 'is', null);

      // Fetch distinct proposal_type per client_id from sales
      const { data: saleRows } = await supabase
        .from('sales')
        .select('client_id, proposal_type')
        .eq('organization_id', organization!.id)
        .not('client_id', 'is', null)
        .not('proposal_type', 'is', null);

      const map: Record<string, Set<string>> = {};

      const addToMap = (rows: { client_id: string | null; proposal_type: string | null }[] | null) => {
        if (!rows) return;
        for (const row of rows) {
          if (!row.client_id || !row.proposal_type) continue;
          if (!map[row.client_id]) map[row.client_id] = new Set();
          map[row.client_id].add(row.proposal_type);
        }
      };

      addToMap(proposalRows);
      addToMap(saleRows);

      // Convert Sets to arrays for easier consumption
      const result: Record<string, string[]> = {};
      for (const [id, types] of Object.entries(map)) {
        result[id] = Array.from(types);
      }
      return result;
    },
  });

  return { clientTypesMap, isTelecom };
}
