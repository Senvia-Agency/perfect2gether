import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardPeriod } from "@/stores/useDashboardPeriod";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface StripeCommissionRecord {
  id: string;
  sale_id: string;
  user_id: string;
  client_org_id: string;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  stripe_invoice_id: string | null;
  period_start: string | null;
  period_end: string | null;
  plan: string | null;
  status: string;
  created_at: string;
}

export interface StripeCommissionByUser {
  userId: string;
  fullName: string;
  records: (StripeCommissionRecord & { clientOrgName: string })[];
  totalAmount: number;
  totalCommission: number;
}

export function useStripeCommissions() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { selectedMonth } = useDashboardPeriod();

  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["stripe-commissions", orgId, monthStart],
    queryFn: async (): Promise<{ byUser: StripeCommissionByUser[]; grandTotal: number }> => {
      if (!orgId) return { byUser: [], grandTotal: 0 };

      const { data: records, error } = await supabase
        .from("stripe_commission_records")
        .select("*")
        .eq("organization_id", orgId)
        .gte("created_at", `${monthStart}T00:00:00`)
        .lte("created_at", `${monthEnd}T23:59:59`)
        .order("created_at", { ascending: false }) as any;

      if (error) throw error;
      if (!records || records.length === 0) return { byUser: [], grandTotal: 0 };

      // Get unique user IDs and client org IDs
      const userIds = [...new Set(records.map((r: any) => r.user_id))] as string[];
      const clientOrgIds = [...new Set(records.map((r: any) => r.client_org_id))] as string[];

      const [profilesRes, orgsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", userIds),
        supabase.from("organizations").select("id, name").in("id", clientOrgIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));
      const orgMap = new Map((orgsRes.data || []).map(o => [o.id, o.name]));

      const grouped = new Map<string, (StripeCommissionRecord & { clientOrgName: string })[]>();

      for (const r of records) {
        const enriched = { ...r, clientOrgName: orgMap.get(r.client_org_id) || "Desconhecido" };
        const existing = grouped.get(r.user_id) || [];
        existing.push(enriched);
        grouped.set(r.user_id, existing);
      }

      let grandTotal = 0;
      const byUser: StripeCommissionByUser[] = [];

      for (const [userId, userRecords] of grouped) {
        const totalCommission = userRecords.reduce((s, r) => s + Number(r.commission_amount), 0);
        const totalAmount = userRecords.reduce((s, r) => s + Number(r.amount), 0);
        grandTotal += totalCommission;

        byUser.push({
          userId,
          fullName: profileMap.get(userId) || "Desconhecido",
          records: userRecords,
          totalAmount,
          totalCommission,
        });
      }

      byUser.sort((a, b) => b.totalCommission - a.totalCommission);
      return { byUser, grandTotal };
    },
    enabled: !!orgId,
  });
}
