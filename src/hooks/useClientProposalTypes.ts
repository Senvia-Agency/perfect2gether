import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { requireReadSuccess } from '@/lib/query-resilience';

export function useClientProposalTypes() {
  const { organization } = useAuth();
  const isTelecom = organization?.niche === 'telecom';

  const { data: clientTypesMap = {} } = useQuery({
    queryKey: ['client-proposal-types', organization?.id],
    staleTime: 30_000,
    enabled: !!organization?.id && isTelecom,
    queryFn: async () => {
      // Fetch distinct proposal_type per client_id from proposals
      const { data: proposalRows, error: proposalError } = await supabase
        .from('proposals')
        .select('client_id, proposal_type')
        .eq('organization_id', organization!.id)
        .not('client_id', 'is', null)
        .not('proposal_type', 'is', null);

      requireReadSuccess({ data: proposalRows, error: proposalError });

      // Fetch distinct proposal_type per client_id from sales
      const { data: saleRows, error: saleError } = await supabase
        .from('sales')
        .select('client_id, proposal_type')
        .eq('organization_id', organization!.id)
        .not('client_id', 'is', null)
        .not('proposal_type', 'is', null);

      requireReadSuccess({ data: saleRows, error: saleError });

      // Fetch distinct equipment_type per client_id from cpes
      // (imported clients have CPEs but no proposals/sales)
      const { data: cpeRows, error: cpeError } = await supabase
        .from('cpes')
        .select('client_id, equipment_type')
        .eq('organization_id', organization!.id)
        .not('client_id', 'is', null)
        .not('equipment_type', 'is', null);

      requireReadSuccess({ data: cpeRows, error: cpeError });

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

      // Map CPE equipment_type to proposal_type filter values
      const cpeTypeMap: Record<string, string> = {
        'energia': 'energia',
        'serviços': 'servicos',
        'servicos': 'servicos',
      };
      if (cpeRows) {
        for (const row of cpeRows) {
          if (!row.client_id || !row.equipment_type) continue;
          const normalized = row.equipment_type.toLowerCase().trim();
          const filterValue = cpeTypeMap[normalized];
          if (!filterValue) continue;
          if (!map[row.client_id]) map[row.client_id] = new Set();
          map[row.client_id].add(filterValue);
        }
      }

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
