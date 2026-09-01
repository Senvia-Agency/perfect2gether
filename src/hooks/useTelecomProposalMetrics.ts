import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useTelecomProposalMetrics() {
  const { organization } = useAuth();
  const isTelecom = organization?.niche === 'telecom';

  return useQuery({
    queryKey: ['telecom-proposal-metrics', organization?.id],
    queryFn: async () => {
      // Sum consumo_anual from proposal_cpes via join with proposals
      const { data: cpes, error: cpesError } = await supabase
        .from('proposal_cpes')
        .select('consumo_anual, proposal_id, proposals!inner(organization_id, proposal_type)')
        .eq('proposals.organization_id', organization!.id);

      if (cpesError) throw cpesError;

      // O MWh e exclusivo de energia. proposal_type a null conta como energia,
      // igual ao backfill da BD e aos cards.
      type CpeRow = { consumo_anual: number | null; proposals: { proposal_type: string | null } | null };
      const energiaConsumo = (rows: unknown) => ((rows || []) as CpeRow[])
        .filter((c) => (c.proposals?.proposal_type ?? 'energia') !== 'servicos')
        .reduce((sum, c) => sum + (Number(c.consumo_anual) || 0), 0);

      const totalConsumo = energiaConsumo(cpes);

      // Sum kwp from proposals where proposal_type = 'servicos'
      const { data: servicosProposals, error: sError } = await supabase
        .from('proposals')
        .select('kwp')
        .eq('organization_id', organization!.id)
        .eq('proposal_type', 'servicos');

      if (sError) throw sError;

      const totalKWp = (servicosProposals || []).reduce(
        (sum, p) => sum + (Number(p.kwp) || 0),
        0
      );

      // Pending metrics (sent + negotiating)
      const { data: pendingCpes, error: pcError } = await supabase
        .from('proposal_cpes')
        .select('consumo_anual, proposal_id, proposals!inner(organization_id, status, proposal_type)')
        .eq('proposals.organization_id', organization!.id)
        .in('proposals.status', ['sent', 'negotiating']);

      if (pcError) throw pcError;

      const pendingConsumo = energiaConsumo(pendingCpes);

      const { data: pendingServicos, error: psError } = await supabase
        .from('proposals')
        .select('kwp')
        .eq('organization_id', organization!.id)
        .eq('proposal_type', 'servicos')
        .in('status', ['sent', 'negotiating']);

      if (psError) throw psError;

      const pendingKWp = (pendingServicos || []).reduce(
        (sum, p) => sum + (Number(p.kwp) || 0),
        0
      );

      return {
        totalMWh: totalConsumo / 1000,
        totalKWp,
        pendingMWh: pendingConsumo / 1000,
        pendingKWp,
      };
    },
    enabled: !!organization?.id && isTelecom,
  });
}
