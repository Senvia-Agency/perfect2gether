import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface UserSalesMetrics {
  userId: string;
  nifs: number;
  energia: number; // MWh
  solar: number;   // kWp
  comissao: number;
}

export function useMonthSalesMetrics(referenceDate?: Date) {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const ref = referenceDate || new Date();
  const monthStart = format(startOfMonth(ref), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(ref), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["month-sales-metrics", orgId, monthStart],
    queryFn: async (): Promise<UserSalesMetrics[]> => {
      if (!orgId) return [];

      // 1. Fetch fulfilled sales
      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, created_by, proposal_id")
        .eq("organization_id", orgId)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd)
        .eq("status", "fulfilled");

      if (error) throw error;
      if (!sales?.length) return [];

      // 2. Get proposal_ids and fetch proposal_cpes
      const proposalIds = [...new Set(sales.map(s => s.proposal_id).filter(Boolean))] as string[];

      let cpesByProposal = new Map<string, { consumo: number; comissao: number }>();
      if (proposalIds.length > 0) {
        const { data: cpes } = await supabase
          .from("proposal_cpes")
          .select("proposal_id, consumo_anual, comissao")
          .in("proposal_id", proposalIds);

        if (cpes) {
          for (const cpe of cpes) {
            const existing = cpesByProposal.get(cpe.proposal_id) || { consumo: 0, comissao: 0 };
            existing.consumo += Number(cpe.consumo_anual || 0);
            existing.comissao += Number(cpe.comissao || 0);
            cpesByProposal.set(cpe.proposal_id, existing);
          }
        }
      }

      // 3. Get proposal metadata + kWp from proposals
      const eligibleEnergyNegotiationTypes = new Set(["angariacao", "angariacao_indexado"]);
      const proposalMetricsById = new Map<string, {
        proposalType: string | null;
        negotiationType: string | null;
        solar: number;
      }>();

      if (proposalIds.length > 0) {
        const { data: proposals } = await supabase
          .from("proposals")
          .select("id, proposal_type, negotiation_type, servicos_details")
          .in("id", proposalIds);

        if (proposals) {
          for (const p of proposals) {
            let totalKwp = 0;
            const details = p.servicos_details as Record<string, { kwp?: number }> | null;
            if (details && typeof details === "object") {
              for (const prod of Object.values(details)) {
                totalKwp += prod?.kwp || 0;
              }
            }

            proposalMetricsById.set(p.id, {
              proposalType: p.proposal_type,
              negotiationType: p.negotiation_type,
              solar: totalKwp,
            });
          }
        }
      }

      // 4. Group by created_by
      const grouped = new Map<string, { contracts: number; energia: number; solar: number; comissao: number }>();

      for (const sale of sales) {
        const uid = sale.created_by;
        if (!uid) continue;

        if (!grouped.has(uid)) {
          grouped.set(uid, { contracts: 0, energia: 0, solar: 0, comissao: 0 });
        }
        const g = grouped.get(uid)!;

        const cpeData = sale.proposal_id ? cpesByProposal.get(sale.proposal_id) : null;
        const proposalMetrics = sale.proposal_id ? proposalMetricsById.get(sale.proposal_id) : null;
        const countsForEnergyMetrics =
          proposalMetrics?.proposalType === "energia" &&
          eligibleEnergyNegotiationTypes.has(proposalMetrics.negotiationType || "");

        g.contracts += 1;
        g.energia += countsForEnergyMetrics ? (cpeData?.consumo ?? 0) / 1000 : 0; // kWh → MWh
        g.solar += countsForEnergyMetrics ? proposalMetrics?.solar || 0 : 0;
        g.comissao += countsForEnergyMetrics ? cpeData?.comissao ?? 0 : 0;
      }

      return Array.from(grouped.entries()).map(([userId, g]) => ({
        userId,
        nifs: g.contracts,
        energia: g.energia,
        solar: g.solar,
        comissao: g.comissao,
      }));
    },
    enabled: !!orgId,
  });
}
