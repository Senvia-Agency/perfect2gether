import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, format } from "date-fns";
import { toast } from "sonner";

export interface ObjectiveTotals {
  total_nifs: number;
  total_energia_mwh: number;
  total_solar_kwp: number;
  total_comissao: number;
}

export interface MonthlyObjective extends ObjectiveTotals {
  id: string;
  organization_id: string;
  user_id: string;
  month: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useMonthlyObjectives(referenceDate?: Date) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const currentMonth = format(startOfMonth(referenceDate || new Date()), "yyyy-MM-dd");

  const { data: objectives = [], isLoading } = useQuery({
    queryKey: ["monthly-objectives", orgId, currentMonth],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("monthly_objectives" as any)
        .select("*")
        .eq("organization_id", orgId)
        .eq("month", currentMonth);
      if (error) throw error;
      return (data || []) as unknown as MonthlyObjective[];
    },
    enabled: !!orgId,
  });

  const saveObjective = useMutation({
    mutationFn: async ({ userId, totals }: { userId: string; totals: ObjectiveTotals }) => {
      if (!orgId) throw new Error("Sem organização");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem utilizador");

      const { error } = await supabase
        .from("monthly_objectives" as any)
        .upsert(
          {
            organization_id: orgId,
            user_id: userId,
            month: currentMonth,
            total_nifs: totals.total_nifs,
            total_energia_mwh: totals.total_energia_mwh,
            total_solar_kwp: totals.total_solar_kwp,
            total_comissao: totals.total_comissao,
            created_by: user.id,
          } as any,
          { onConflict: "organization_id,user_id,month" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-objectives"] });
      toast.success("Objetivo guardado com sucesso");
    },
    onError: (err: any) => {
      toast.error("Erro ao guardar objetivo: " + err.message);
    },
  });

  return { objectives, isLoading, saveObjective };
}
