import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { RhHoliday } from "@/lib/rh-utils";

export function useRhHolidays() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ["rh-holidays", orgId, currentYear],
    queryFn: async (): Promise<RhHoliday[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("rh_holidays")
        .select("id, date, name, year, is_national")
        .eq("organization_id", orgId)
        .gte("year", currentYear)
        .lte("year", currentYear + 1);

      if (error) throw error;
      return (data || []) as RhHoliday[];
    },
    enabled: !!orgId,
  });
}
