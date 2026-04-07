import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardPeriod } from "@/stores/useDashboardPeriod";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface CommissionSaleDetail {
  saleId: string;
  saleCode: string | null;
  saleDate: string;
  totalValue: number;
  commissionRate: number;
  commissionValue: number;
  createdBy: string;
  fullName: string;
}

export interface CommissionByUser {
  userId: string;
  fullName: string;
  sales: CommissionSaleDetail[];
  totalSales: number;
  totalCommission: number;
}

interface SalesSettings {
  commissions_enabled?: boolean;
  commission_percentage?: number | null;
}

export function useCommissionsDetail() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { selectedMonth } = useDashboardPeriod();

  const salesSettings = (organization?.sales_settings as SalesSettings) || {};
  const commissionsEnabled = !!salesSettings.commissions_enabled;
  const globalRate = salesSettings.commission_percentage || null;

  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["commissions-detail", orgId, commissionsEnabled, monthStart],
    queryFn: async (): Promise<{ byUser: CommissionByUser[]; grandTotal: number }> => {
      if (!orgId || !commissionsEnabled) return { byUser: [], grandTotal: 0 };

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, code, sale_date, total_value, created_by")
        .eq("organization_id", orgId)
        .in("status", ["fulfilled", "delivered"])
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd);

      if (salesError) throw salesError;

      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, commission_rate")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      if (membersError) throw membersError;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("organization_id", orgId);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      const memberRateMap = new Map(members?.map(m => [m.user_id, Number(m.commission_rate || 0)]) || []);

      const grouped = new Map<string, CommissionSaleDetail[]>();

      for (const sale of sales || []) {
        if (!sale.created_by) continue;
        const rate = globalRate && globalRate > 0 ? globalRate : (memberRateMap.get(sale.created_by) || 0);
        const commissionValue = Number(sale.total_value || 0) * (rate / 100);

        const detail: CommissionSaleDetail = {
          saleId: sale.id,
          saleCode: sale.code,
          saleDate: sale.sale_date,
          totalValue: Number(sale.total_value || 0),
          commissionRate: rate,
          commissionValue,
          createdBy: sale.created_by,
          fullName: profileMap.get(sale.created_by) || "Desconhecido",
        };

        const existing = grouped.get(sale.created_by) || [];
        existing.push(detail);
        grouped.set(sale.created_by, existing);
      }

      let grandTotal = 0;
      const byUser: CommissionByUser[] = [];

      for (const [userId, userSales] of grouped) {
        const totalCommission = userSales.reduce((sum, s) => sum + s.commissionValue, 0);
        const totalSales = userSales.reduce((sum, s) => sum + s.totalValue, 0);
        grandTotal += totalCommission;

        byUser.push({
          userId,
          fullName: profileMap.get(userId) || "Desconhecido",
          sales: userSales.sort((a, b) => b.saleDate.localeCompare(a.saleDate)),
          totalSales,
          totalCommission,
        });
      }

      byUser.sort((a, b) => b.totalCommission - a.totalCommission);

      return { byUser, grandTotal };
    },
    enabled: !!orgId && commissionsEnabled,
  });
}
