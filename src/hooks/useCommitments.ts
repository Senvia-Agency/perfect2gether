import { usePermissions } from '@/hooks/usePermissions';
import { isPerfect2GetherOrg } from '@/lib/perfect2gether';
import { CommitmentAlreadySavedError, getCommitmentSaveError } from '@/lib/commitment-errors';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, addMonths, format } from "date-fns";
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
  const { user, organization, organizations } = useAuth();
  const { can, isAdmin, isProfileAdmin, isLoadingPermissions } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = organization?.id;
  const currentMonth = format(startOfMonth(referenceDate || new Date()), "yyyy-MM-dd");
  const nextMonth = format(addMonths(startOfMonth(referenceDate || new Date()), 1), "yyyy-MM-dd");
  const effectiveUserId = targetUserId || user?.id;
  const lockEnabled = isPerfect2GetherOrg(orgId);
  const isMembershipAdmin = organizations.some(member => member.organization_id === orgId && member.is_active && (member.member_role === "admin" || member.member_role === "super_admin"));
  const canCorrectCommitments = isAdmin || isProfileAdmin || isMembershipAdmin || (!isLoadingPermissions && can("gestao", "commitments", "manage"));

  const queryKey = ["commitments", orgId, currentMonth, effectiveUserId];

  const { data: commitment, isLoading, isSuccess } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!orgId || !effectiveUserId) return null;

      const query = supabase.from("monthly_commitments").select("*")
        .eq("organization_id", orgId).eq("user_id", effectiveUserId);
      const { data: mc, error } = await (lockEnabled
        ? query.gte("month", currentMonth).lt("month", nextMonth).order("month", { ascending: true }).limit(1)
        : query.eq("month", currentMonth)).maybeSingle();

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

      const query = supabase.from("monthly_commitments").select("*").eq("organization_id", orgId);
      const { data, error } = await (lockEnabled
        ? query.gte("month", currentMonth).lt("month", nextMonth).order("month", { ascending: true })
        : query.eq("month", currentMonth));

      if (error) throw error;
      return (data || []) as Commitment[];
    },
    enabled: !!orgId,
  });

  const isReadOnly = lockEnabled && !!commitment && !canCorrectCommitments;
  const canSaveCommitment = !isLoadingPermissions && isSuccess && (!lockEnabled || canCorrectCommitments || (effectiveUserId === user?.id && !commitment));

  const saveCommitment = useMutation({
    mutationFn: async (totals: CommitmentTotals) => {
      if (!orgId || !effectiveUserId) throw new Error("Sem organização/utilizador");

      if (lockEnabled && !canSaveCommitment) throw new CommitmentAlreadySavedError();
      const values = {
        organization_id: orgId,
        user_id: effectiveUserId,
        month: currentMonth,
        total_nifs: totals.total_nifs,
        total_energia_mwh: totals.total_energia_mwh,
        total_solar_kwp: totals.total_solar_kwp,
        total_comissao: totals.total_comissao,
      };
      const query = supabase.from("monthly_commitments");
      const { error } = await (lockEnabled && !canCorrectCommitments
        ? query.insert(values)
        : query.upsert(values, { onConflict: "organization_id,user_id,month" }));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitments"] });
      queryClient.invalidateQueries({ queryKey: ["commitments-all"] });
      toast.success("Compromisso guardado com sucesso");
    },
    onError: (err) => {
      toast.error(getCommitmentSaveError(err, lockEnabled && !canCorrectCommitments));
    },
  });

  return {
    commitment,
    isLoading: isLoading || isLoadingPermissions,
    isReadOnly,
    canSaveCommitment,
    canCorrectCommitments,
    lockEnabled,
    allCommitments: allCommitmentsQuery.data || [],
    allLoading: allCommitmentsQuery.isLoading,
    saveCommitment,
  };
}
