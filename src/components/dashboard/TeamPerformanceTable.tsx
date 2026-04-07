import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { pt } from "date-fns/locale";
import { Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProposals } from "@/hooks/useProposals";
import { useTeamMembers, type TeamMember } from "@/hooks/useTeam";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardPeriod } from "@/stores/useDashboardPeriod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintCardButton } from "./PrintCardButton";

function formatCurrency(val: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(val);
}

function getConversionTone(rate: number) {
  if (rate >= 50) return "text-primary";
  if (rate >= 25) return "text-foreground";
  return "text-destructive";
}

function getScopeLabel(dataScope: string, selectedMemberName: string | null, isTeamLeader: boolean) {
  if (selectedMemberName) return `Filtro ativo: ${selectedMemberName}`;
  if (dataScope === "all") return "A mostrar todos os colaboradores";
  if (dataScope === "team" && isTeamLeader) return "A mostrar a sua equipa";
  return "A mostrar apenas os seus dados";
}

interface MemberPerformance {
  userId: string;
  name: string;
  leads: number;
  proposals: number;
  openProposalValue: number;
  salesDelivered: number;
  commission: number;
  conversionRate: number;
}

export function TeamPerformanceTable() {
  const { user, profile, organization } = useAuth();
  const { data: members = [] } = useTeamMembers();
  const { data: scopedProposals = [], isLoading: proposalsLoading } = useProposals();
  const { selectedMemberId, canFilterByTeam, isTeamLeader, teamMemberIds, dataScope } = useTeamFilter();
  const { selectedMonth } = useDashboardPeriod();
  const cardRef = useRef<HTMLDivElement>(null);

  const orgId = organization?.id;
  const monthStartDate = startOfMonth(selectedMonth);
  const monthEndDate = endOfMonth(selectedMonth);
  const monthStart = monthStartDate.toISOString();
  const monthEnd = monthEndDate.toISOString();
  const monthStartMs = monthStartDate.getTime();
  const monthEndMs = monthEndDate.getTime();
  const currentMonthLabel = format(monthStartDate, "MMMM yyyy", { locale: pt });

  const allMemberList = useMemo(() => {
    const activeMembers = members.filter((member) => !member.is_banned);
    const membersMap = new Map(activeMembers.map((member) => [member.user_id, member]));

    if (user?.id && !membersMap.has(user.id)) {
      const fallbackCurrentUser: TeamMember = {
        id: user.id,
        user_id: user.id,
        full_name: profile?.full_name || "Eu",
        avatar_url: null,
        email: null,
        phone: null,
        organization_id: orgId || null,
        role: "viewer",
        is_banned: false,
        profile_id: null,
        profile_name: null,
      };

      membersMap.set(user.id, fallbackCurrentUser);
    }

    return Array.from(membersMap.values());
  }, [members, orgId, profile?.full_name, user?.id]);

  const filteredMembers = useMemo(() => {
    if (dataScope === "own" || !canFilterByTeam) {
      return allMemberList.filter((member) => member.user_id === user?.id);
    }

    if (selectedMemberId) {
      return allMemberList.filter((member) => member.user_id === selectedMemberId);
    }

    if (dataScope === "team" && isTeamLeader) {
      const allowed = new Set([user?.id, ...teamMemberIds].filter(Boolean));
      return allMemberList.filter((member) => allowed.has(member.user_id));
    }

    return allMemberList;
  }, [allMemberList, canFilterByTeam, dataScope, isTeamLeader, selectedMemberId, teamMemberIds, user?.id]);

  const memberIds = filteredMembers.map((member) => member.user_id);

  const selectedMemberName = useMemo(() => {
    if (!selectedMemberId) return null;
    return allMemberList.find((member) => member.user_id === selectedMemberId)?.full_name || null;
  }, [allMemberList, selectedMemberId]);

  const proposalsInPeriod = useMemo(() => {
    if (memberIds.length === 0) return [];

    return scopedProposals.filter((proposal) => {
      if (!proposal.created_by || !memberIds.includes(proposal.created_by)) return false;
      const createdAtMs = new Date(proposal.created_at).getTime();
      return createdAtMs >= monthStartMs && createdAtMs <= monthEndMs;
    });
  }, [memberIds, monthEndMs, monthStartMs, scopedProposals]);

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["team-perf-leads", orgId, monthStart, monthEnd, memberIds],
    queryFn: async () => {
      if (!orgId || memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("assigned_to")
        .eq("organization_id", orgId)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd)
        .in("assigned_to", memberIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && memberIds.length > 0,
  });

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["team-perf-sales", orgId, monthStart, monthEnd, memberIds],
    queryFn: async () => {
      if (!orgId || memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("sales")
        .select("created_by, status, comissao")
        .eq("organization_id", orgId)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd)
        .in("created_by", memberIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && memberIds.length > 0,
  });

  const loading = leadsLoading || proposalsLoading || salesLoading;

  const rows: MemberPerformance[] = useMemo(() => {
    return filteredMembers.map((member) => {
      const memberLeads = (leadsData || []).filter((lead) => lead.assigned_to === member.user_id).length;
      const memberProposals = proposalsInPeriod.filter((proposal) => proposal.created_by === member.user_id);
      const openProposalValue = memberProposals
        .filter((proposal) => proposal.status === "draft" || proposal.status === "sent" || proposal.status === "negotiating")
        .reduce((sum, proposal) => sum + (proposal.total_value || 0), 0);
      const memberSales = (salesData || []).filter((sale) => sale.created_by === member.user_id);
      const delivered = memberSales.filter((sale) => sale.status === "delivered" || sale.status === "completed");
      const commission = delivered.reduce((sum, sale) => sum + (sale.comissao || 0), 0);
      const conversionRate = memberLeads > 0 ? (delivered.length / memberLeads) * 100 : 0;

      return {
        userId: member.user_id,
        name: member.full_name + (member.user_id === user?.id ? " (eu)" : ""),
        leads: memberLeads,
        proposals: memberProposals.length,
        openProposalValue,
        salesDelivered: delivered.length,
        commission,
        conversionRate,
      };
    });
  }, [filteredMembers, leadsData, proposalsInPeriod, salesData, user?.id]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        leads: acc.leads + row.leads,
        proposals: acc.proposals + row.proposals,
        openProposalValue: acc.openProposalValue + row.openProposalValue,
        salesDelivered: acc.salesDelivered + row.salesDelivered,
        commission: acc.commission + row.commission,
      }),
      { leads: 0, proposals: 0, openProposalValue: 0, salesDelivered: 0, commission: 0 },
    );
  }, [rows]);

  const totalConversion = totals.leads > 0 ? (totals.salesDelivered / totals.leads) * 100 : 0;
  const showTotals = rows.length > 1;
  const scopeLabel = getScopeLabel(dataScope, selectedMemberName, isTeamLeader);

  return (
    <Card ref={cardRef}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-base capitalize">
                Performance da Equipa — {currentMonthLabel}
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">{scopeLabel}</p>
          </div>
          <PrintCardButton targetRef={cardRef} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Colaborador</TableHead>
                  <TableHead className="text-xs text-right">Leads</TableHead>
                  <TableHead className="text-xs text-right">Propostas</TableHead>
                  <TableHead className="text-xs text-right hidden sm:table-cell">Valor Prop. Abertas</TableHead>
                  <TableHead className="text-xs text-right">Vendas</TableHead>
                  <TableHead className="text-xs text-right hidden sm:table-cell">Comissão</TableHead>
                  <TableHead className="text-xs text-right">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="text-xs py-1.5 font-medium">{row.name}</TableCell>
                    <TableCell className="text-xs text-right py-1.5">{row.leads}</TableCell>
                    <TableCell className="text-xs text-right py-1.5">{row.proposals}</TableCell>
                    <TableCell className="text-xs text-right py-1.5 hidden sm:table-cell">{formatCurrency(row.openProposalValue)}</TableCell>
                    <TableCell className="text-xs text-right py-1.5">{row.salesDelivered}</TableCell>
                    <TableCell className="text-xs text-right py-1.5 hidden sm:table-cell text-primary font-medium">{formatCurrency(row.commission)}</TableCell>
                    <TableCell className="text-xs text-right py-1.5 font-medium">
                      <span className={getConversionTone(row.conversionRate)}>{row.conversionRate.toFixed(0)}%</span>
                    </TableCell>
                  </TableRow>
                ))}
                {showTotals && (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell className="text-xs font-semibold py-1.5">TOTAL</TableCell>
                    <TableCell className="text-xs text-right font-semibold py-1.5">{totals.leads}</TableCell>
                    <TableCell className="text-xs text-right font-semibold py-1.5">{totals.proposals}</TableCell>
                    <TableCell className="text-xs text-right font-semibold py-1.5 hidden sm:table-cell">{formatCurrency(totals.openProposalValue)}</TableCell>
                    <TableCell className="text-xs text-right font-semibold py-1.5">{totals.salesDelivered}</TableCell>
                    <TableCell className="text-xs text-right font-semibold py-1.5 hidden sm:table-cell text-primary">{formatCurrency(totals.commission)}</TableCell>
                    <TableCell className="text-xs text-right font-semibold py-1.5">
                      <span className={getConversionTone(totalConversion)}>{totalConversion.toFixed(0)}%</span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
