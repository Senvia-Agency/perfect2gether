import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useTelecomSaleMetrics() {
  const { organization } = useAuth();
  const isTelecom = organization?.niche === 'telecom';

  return useQuery({
    queryKey: ['telecom-sale-metrics', organization?.id],
    queryFn: async () => {
      // Total metrics
      const { data: allSales, error: allError } = await supabase
        .from('sales')
        .select('consumo_anual, kwp, proposal_type, status')
        .eq('organization_id', organization!.id);

      if (allError) throw allError;

      const sales = allSales || [];

      const totalMWh = sales.reduce((sum, s) => sum + (Number(s.consumo_anual) || 0), 0) / 1000;
      const totalKWp = sales
        .filter(s => s.proposal_type === 'servicos')
        .reduce((sum, s) => sum + (Number(s.kwp) || 0), 0);

      const delivered = sales.filter(s => s.status === 'delivered' || s.status === 'fulfilled');
      const deliveredMWh = delivered.reduce((sum, s) => sum + (Number(s.consumo_anual) || 0), 0) / 1000;
      const deliveredKWp = delivered
        .filter(s => s.proposal_type === 'servicos')
        .reduce((sum, s) => sum + (Number(s.kwp) || 0), 0);

      return { totalMWh, totalKWp, deliveredMWh, deliveredKWp };
    },
    enabled: !!organization?.id && isTelecom,
  });
}
