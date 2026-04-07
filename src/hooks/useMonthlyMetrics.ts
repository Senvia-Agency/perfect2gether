import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, format } from "date-fns";
import { toast } from "sonner";

export interface MonthlyMetric {
  id: string;
  organization_id: string;
  user_id: string;
  month: string;
  op_energia: number;
  energia: number;
  op_solar: number;
  solar: number;
  op_comissao: number;
  comissao: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetricValues {
  op_energia: number;
  energia: number;
  op_solar: number;
  solar: number;
  op_comissao: number;
  comissao: number;
}

export function useMonthlyMetrics(referenceDate?: Date) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const currentMonth = format(startOfMonth(referenceDate || new Date()), "yyyy-MM-dd");

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["monthly-metrics", orgId, currentMonth],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("monthly_metrics" as any)
        .select("*")
        .eq("organization_id", orgId)
        .eq("month", currentMonth);
      if (error) throw error;
      return (data || []) as unknown as MonthlyMetric[];
    },
    enabled: !!orgId,
  });

  const saveMetric = useMutation({
    mutationFn: async ({ userId, values }: { userId: string; values: MetricValues }) => {
      if (!orgId) throw new Error("Sem organização");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem utilizador");

      const { error } = await supabase
        .from("monthly_metrics" as any)
        .upsert(
          {
            organization_id: orgId,
            user_id: userId,
            month: currentMonth,
            ...values,
            created_by: user.id,
          } as any,
          { onConflict: "organization_id,user_id,month" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-metrics"] });
      toast.success("Métricas guardadas com sucesso");
    },
    onError: (err: any) => {
      toast.error("Erro ao guardar métricas: " + err.message);
    },
  });

  return { metrics, isLoading, saveMetric };
}
