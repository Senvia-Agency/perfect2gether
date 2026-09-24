import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Proposal } from '@/types/proposals';

/** Consumo por proposta, limitado às mesmas propostas que a página apresenta. */
export function useTelecomProposalMetrics(proposals: Proposal[]) {
  const { organization, user } = useAuth();
  const proposalIds = proposals
    .filter((proposal) => (proposal.proposal_type ?? 'energia') === 'energia')
    .map((proposal) => proposal.id)
    .sort();
  const isTelecom = organization?.niche === 'telecom';

  return useQuery({
    queryKey: ['metrics-proposal-cpes', organization?.id, user?.id, proposalIds],
    queryFn: async (): Promise<Record<string, number>> => {
      const consumptionByProposal: Record<string, number> = {};

      // Limita o tamanho do filtro e pagina também os CPEs de propostas grandes.
      for (let offset = 0; offset < proposalIds.length; offset += 100) {
        const batch = proposalIds.slice(offset, offset + 100);
        for (let page = 0; ; page += 1) {
          const { data, error } = await supabase
            .from('proposal_cpes')
            .select('id, proposal_id, consumo_anual')
            .in('proposal_id', batch)
            .order('id', { ascending: true })
            .range(page * 1000, page * 1000 + 999);

          if (error) throw error;
          for (const cpe of data || []) {
            consumptionByProposal[cpe.proposal_id] =
              (consumptionByProposal[cpe.proposal_id] || 0) + (Number(cpe.consumo_anual) || 0);
          }
          if (!data || data.length < 1000) break;
        }
      }

      return consumptionByProposal;
    },
    enabled: isTelecom && proposalIds.length > 0,
  });
}
