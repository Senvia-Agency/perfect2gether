import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, format } from "date-fns";
import { toast } from "sonner";

export interface CommitmentTotals {
  total_nifs: number;
  total_energia_mwh: number;
  total_solar_kwp: number;
  total_comissao: number;
}

export interface Commitment extends CommitmentTotals {
  id: string;
  organization_id: string;
  user_id: string;
  month: string;
  created_at: string;
  updated_at: string;
}

export function useCommitments(targetUserId?: string | null, referenceDate?: Date) {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const currentMonth = format(startOfMonth(referenceDate || new Date()), "yyyy-MM-dd");
  const effectiveUserId = targetUserId || user?.id;

  const queryKey = ["commitments", orgId, currentMonth, effectiveUserId];

  const { data: commitment, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!orgId || !effectiveUserId) return null;

      const { data: mc, error } = await supabase
        .from("monthly_commitments")
        .select("*")
        .eq("organization_id", orgId)
        .eq("user_id", effectiveUserId)
        .eq("month", currentMonth)
        .maybeSingle();

      if (error) throw error;
      return mc as Commitment | null;
    },
    enabled: !!orgId && !!effectiveUserId,
  });

  // Fetch all commitments for the org (admin view)
  const allCommitmentsQuery = useQuery({
    queryKey: ["commitments-all", orgId, currentMonth],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from("monthly_commitments")
        .select("*")
        .eq("organization_id", orgId)
        .eq("month", currentMonth);

      if (error) throw error;
      return (data || []) as Commitment[];
    },
    enabled: !!orgId,
  });

  const saveCommitment = useMutation({
    mutationFn: async (totals: CommitmentTotals) => {
      if (!orgId || !user?.id) throw new Error("Sem organização/utilizador");

      const { error } = await supabase
        .from("monthly_commitments")
        .upsert(
          {
            organization_id: orgId,
            user_id: user.id,
            month: currentMonth,
            total_nifs: totals.total_nifs,
            total_energia_mwh: totals.total_energia_mwh,
            total_solar_kwp: totals.total_solar_kwp,
            total_comissao: totals.total_comissao,
          },
          { onConflict: "organization_id,user_id,month" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["commitments-all"] });
      toast.success("Compromisso guardado com sucesso");
    },
    onError: (err: any) => {
      toast.error("Erro ao guardar compromisso: " + err.message);
    },
  });

  return {
    commitment,
    isLoading,
    allCommitments: allCommitmentsQuery.data || [],
    allLoading: allCommitmentsQuery.isLoading,
    saveCommitment,
  };
}
