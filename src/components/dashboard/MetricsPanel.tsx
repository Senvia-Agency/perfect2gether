import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { useTeamMembers } from "@/hooks/useTeam";
import { useMonthlyMetrics } from "@/hooks/useMonthlyMetrics";
import { useDashboardPeriod } from "@/stores/useDashboardPeriod";
import { useModules } from "@/hooks/useModules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendingUp, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { pt } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { EditMetricsModal } from "./EditMetricsModal";
import { PrintCardButton } from "./PrintCardButton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function formatNumber(val: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(val);
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(val);
}

function formatPercent(actual: number, target: number) {
  if (target === 0) return "—";
  return `${Math.round((actual / target) * 100)}%`;
}

function percentColor(actual: number, target: number) {
  if (target === 0) return "text-muted-foreground";
  const pct = (actual / target) * 100;
  if (pct >= 100) return "text-green-500";
  if (pct >= 50) return "text-amber-500";
  return "text-red-500";
}

interface RitmoRow {
  userId: string;
  name: string;
  opEnergia: number;
  energia: number;
  opSolar: number;
  solar: number;
  comissao: number;
}

export function MetricsPanel() {
  const { user, profile, organization } = useAuth();
  const { isAdmin, can } = usePermissions();
  // Coluna de Comissao apenas para quem tem permissao de a ver.
  const showCommission = can('finance', 'commissions', 'view');
  const { data: members = [] } = useTeamMembers({ excludeAdmins: true });
  const { selectedMemberId, canFilterByTeam, isTeamLeader, teamMemberIds, dataScope } = useTeamFilter();
  const { selectedMonth } = useDashboardPeriod();
  const { metrics, isLoading: metricsLoading } = useMonthlyMetrics(selectedMonth);
  const { modules } = useModules();
  const [editOpen, setEditOpen] = useState(false);
  const [metricasOpen, setMetricasOpen] = useState(true);
  const [ritmoOpen, setRitmoOpen] = useState(true);
  const [concOpen, setConcOpen] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  const showEnergy = organization?.niche === 'telecom' && modules.energy;
  const orgId = organization?.id;
  const currentMonthLabel = format(startOfMonth(selectedMonth), "MMMM yyyy", { locale: pt });

  const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const monthEndStr = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  const { data: proposalsRaw = [], isLoading: proposalsLoading, isError: proposalsError } = useQuery({
    queryKey: ["metrics-proposals-ops", orgId, monthStart],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("proposals")
        .select("id, created_by, proposal_type, kwp, consumo_anual, comissao, servicos_details, client_id")
        .eq("organization_id", orgId)
        .gte("proposal_date", monthStart)
        .lte("proposal_date", monthEndStr)
        .in("status", ["sent", "negotiating", "accepted"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const proposalClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of proposalsRaw) {
      if (p.client_id) ids.add(p.client_id);
    }
    return Array.from(ids);
  }, [proposalsRaw]);

  const proposalIds = useMemo(() => proposalsRaw.map(proposal => proposal.id), [proposalsRaw]);

  const { data: proposalCpeTotals = new Map<string, { count: number; consumo: number; comissao: number; kwp: number }>(), isLoading: cpesLoading, isError: cpesError } = useQuery({
    queryKey: ["metrics-proposal-cpes", orgId, monthStart, proposalIds],
    queryFn: async () => {
      const totals = new Map<string, { count: number; consumo: number; comissao: number; kwp: number }>();
      if (proposalIds.length === 0) return totals;
      const { data, error } = await supabase
        .from("proposal_cpes")
        .select("proposal_id, consumo_anual, comissao, kwp")
        .in("proposal_id", proposalIds);
      if (error) throw error;
      for (const cpe of data || []) {
        const total = totals.get(cpe.proposal_id) || { count: 0, consumo: 0, comissao: 0, kwp: 0 };
        total.count += 1;
        total.consumo += Number(cpe.consumo_anual) || 0;
        total.comissao += Number(cpe.comissao) || 0;
        total.kwp += Number(cpe.kwp) || 0;
        totals.set(cpe.proposal_id, total);
      }
      return totals;
    },
    enabled: !!orgId && proposalIds.length > 0,
  });

  const { data: clientNifMap = new Map<string, string | null>(), isLoading: nifsLoading, isError: nifsError } = useQuery({
    queryKey: ["metrics-client-nifs", proposalClientIds],
    queryFn: async () => {
      if (proposalClientIds.length === 0) return new Map<string, string | null>();
      const { data, error } = await supabase
        .from("crm_clients")
        .select("id, nif")
        .in("id", proposalClientIds);
      if (error) throw error;
      const map = new Map<string, string | null>();
      for (const c of data || []) {
        map.set(c.id, c.nif);
      }
      return map;
    },
    enabled: proposalClientIds.length > 0,
  });

  const loading = metricsLoading || proposalsLoading || cpesLoading || nifsLoading;
  const dataError = proposalsError || cpesError || nifsError;

  const allMemberList = members.length > 0 ? members : (user?.id ? [{ user_id: user.id, full_name: profile?.full_name || "Eu" }] : []);

  const filteredMembers = useMemo(() => {
    if (dataScope === 'own' || !canFilterByTeam) {
      return allMemberList.filter(m => m.user_id === user?.id);
    }
    if (selectedMemberId) {
      return allMemberList.filter(m => m.user_id === selectedMemberId);
    }
    if (dataScope === 'team' && isTeamLeader) {
      const allowed = new Set([user?.id, ...teamMemberIds].filter(Boolean));
      return allMemberList.filter(m => allowed.has(m.user_id));
    }
    return allMemberList;
  }, [allMemberList, dataScope, canFilterByTeam, selectedMemberId, isTeamLeader, teamMemberIds, user?.id]);

  const ritmoRows: RitmoRow[] = useMemo(() => {
    return filteredMembers.map((m) => {
      const userProposals = proposalsRaw.filter(p => p.created_by === m.user_id);
      
      const energiaKeys = new Set<string>();
      const solarKeys = new Set<string>();
      let energia = 0, solar = 0, comissao = 0;
      for (const p of userProposals) {
        const cpeTotals = proposalCpeTotals.get(p.id);
        const serviceDetails = p.servicos_details as Record<string, { kwp?: number }> | null;
        const serviceKwp = serviceDetails && typeof serviceDetails === "object"
          ? Object.values(serviceDetails).reduce((sum, product) => sum + (Number(product?.kwp) || 0), 0)
          : 0;
        const proposalSolarKwp = Number(p.kwp) || serviceKwp || cpeTotals?.kwp || 0;
        const nif = p.client_id ? clientNifMap.get(p.client_id) : null;
        const dedupeKey = nif || p.client_id;
        if (p.proposal_type === "energia") {
          if (dedupeKey) energiaKeys.add(dedupeKey);
          energia += (cpeTotals?.count ? cpeTotals.consumo : Number(p.consumo_anual) || 0) / 1000;
          comissao += cpeTotals?.count ? cpeTotals.comissao : Number(p.comissao) || 0;
        } else if (p.proposal_type === "servicos") {
          if (dedupeKey && proposalSolarKwp > 0) solarKeys.add(dedupeKey);
          solar += proposalSolarKwp;
          comissao += p.comissao != null ? Number(p.comissao) || 0 : cpeTotals?.comissao || 0;
        }
      }
      const opEnergia = energiaKeys.size;
      const opSolar = solarKeys.size;
      return {
        userId: m.user_id,
        name: m.full_name + (m.user_id === user?.id ? " (eu)" : ""),
        opEnergia,
        energia,
        opSolar,
        solar,
        comissao,
      };
    });
  }, [filteredMembers, proposalsRaw, proposalCpeTotals, clientNifMap, user?.id]);

  const sumRitmo = (rows: RitmoRow[]) =>
    rows.reduce((acc, r) => ({
      opEnergia: acc.opEnergia + r.opEnergia,
      energia: acc.energia + r.energia,
      opSolar: acc.opSolar + r.opSolar,
      solar: acc.solar + r.solar,
      comissao: acc.comissao + r.comissao,
    }), { opEnergia: 0, energia: 0, opSolar: 0, solar: 0, comissao: 0 });

  const ritmoTotals = sumRitmo(ritmoRows);
  const showTotals = canFilterByTeam && ritmoRows.length > 1;

  const headers = (opportunities = false) => (
    <TableRow>
      <TableHead className="text-xs whitespace-nowrap">Consultor</TableHead>
      {showEnergy && <TableHead className="text-xs text-right whitespace-nowrap">OP</TableHead>}
      {showEnergy && <TableHead className="text-xs text-right whitespace-nowrap">Energia (MWh)</TableHead>}
      {showEnergy && <TableHead className="text-xs text-right whitespace-nowrap">OP</TableHead>}
      {showEnergy && <TableHead className="text-xs text-right whitespace-nowrap">Solar (kWp)</TableHead>}
      {showCommission && <TableHead className="text-xs text-right whitespace-nowrap">{opportunities ? 'Comissão potencial' : 'Comissão'}</TableHead>}
    </TableRow>
  );

  return (
    <>
      <Card ref={cardRef}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-base capitalize">
                Métricas Mensais — {currentMonthLabel}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <PrintCardButton targetRef={cardRef} />
              {isAdmin && (
                <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : dataError ? (
            <p className="text-sm text-destructive">Não foi possível carregar as oportunidades. Os valores de Ritmo não estão disponíveis.</p>
          ) : (
            <>
              <Collapsible open={metricasOpen} onOpenChange={setMetricasOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 w-full text-left">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">A) Métricas</span>
                  {metricasOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>{headers()}</TableHeader>
                      <TableBody>
                        {filteredMembers.map((m) => {
                          const target = metrics.find((mt) => mt.user_id === m.user_id);
                          return (
                            <TableRow key={m.user_id}>
                              <TableCell className="text-xs py-1.5 font-medium whitespace-nowrap">{m.full_name}{m.user_id === user?.id ? " (eu)" : ""}</TableCell>
                              {showEnergy && <TableCell className="text-xs text-right py-1.5">{target?.op_energia || 0}</TableCell>}
                              {showEnergy && <TableCell className="text-xs text-right py-1.5">{formatNumber(target?.energia || 0)}</TableCell>}
                              {showEnergy && <TableCell className="text-xs text-right py-1.5">{target?.op_solar || 0}</TableCell>}
                              {showEnergy && <TableCell className="text-xs text-right py-1.5">{formatNumber(target?.solar || 0)}</TableCell>}
                              {showCommission && <TableCell className="text-xs text-right py-1.5 font-medium text-primary">{formatCurrency(target?.comissao || 0)}</TableCell>}
                            </TableRow>
                          );
                        })}
                        {showTotals && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell className="text-xs font-semibold py-1.5">TOTAL</TableCell>
                            {showEnergy && <TableCell className="text-xs text-right font-semibold py-1.5">{metrics.reduce((a, m) => a + m.op_energia, 0)}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right font-semibold py-1.5">{formatNumber(metrics.reduce((a, m) => a + m.energia, 0))}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right font-semibold py-1.5">{metrics.reduce((a, m) => a + m.op_solar, 0)}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right font-semibold py-1.5">{formatNumber(metrics.reduce((a, m) => a + m.solar, 0))}</TableCell>}
                            {showCommission && <TableCell className="text-xs text-right font-semibold py-1.5 text-primary">{formatCurrency(metrics.reduce((a, m) => a + m.comissao, 0))}</TableCell>}
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={ritmoOpen} onOpenChange={setRitmoOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 w-full text-left">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">B) Ritmo</span>
                  {ritmoOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>{headers(true)}</TableHeader>
                      <TableBody>
                        {ritmoRows.map((row) => (
                          <TableRow key={row.userId}>
                            <TableCell className="text-xs py-1.5 font-medium whitespace-nowrap">{row.name}</TableCell>
                            {showEnergy && <TableCell className="text-xs text-right py-1.5">{row.opEnergia}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right py-1.5">{formatNumber(row.energia)}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right py-1.5">{row.opSolar}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right py-1.5">{formatNumber(row.solar)}</TableCell>}
                            {showCommission && <TableCell className="text-xs text-right py-1.5 font-medium text-primary">{formatCurrency(row.comissao)}</TableCell>}
                          </TableRow>
                        ))}
                        {showTotals && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell className="text-xs font-semibold py-1.5">TOTAL</TableCell>
                            {showEnergy && <TableCell className="text-xs text-right font-semibold py-1.5">{ritmoTotals.opEnergia}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right font-semibold py-1.5">{formatNumber(ritmoTotals.energia)}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right font-semibold py-1.5">{ritmoTotals.opSolar}</TableCell>}
                            {showEnergy && <TableCell className="text-xs text-right font-semibold py-1.5">{formatNumber(ritmoTotals.solar)}</TableCell>}
                            {showCommission && <TableCell className="text-xs text-right font-semibold py-1.5 text-primary">{formatCurrency(ritmoTotals.comissao)}</TableCell>}
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={concOpen} onOpenChange={setConcOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 w-full text-left">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">C) Concretização das Métricas</span>
                  {concOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>{headers()}</TableHeader>
                      <TableBody>
                        {ritmoRows.map((row) => {
                          const target = metrics.find((m) => m.user_id === row.userId);
                          const tOpE = target?.op_energia || 0;
                          const tE = target?.energia || 0;
                          const tOpS = target?.op_solar || 0;
                          const tS = target?.solar || 0;
                          const tC = target?.comissao || 0;
                          return (
                            <TableRow key={row.userId}>
                              <TableCell className="text-xs py-1.5 font-medium whitespace-nowrap">{row.name}</TableCell>
                              {showEnergy && <TableCell className={`text-xs text-right py-1.5 ${percentColor(row.opEnergia, tOpE)}`}>{formatPercent(row.opEnergia, tOpE)}</TableCell>}
                              {showEnergy && <TableCell className={`text-xs text-right py-1.5 ${percentColor(row.energia, tE)}`}>{formatPercent(row.energia, tE)}</TableCell>}
                              {showEnergy && <TableCell className={`text-xs text-right py-1.5 ${percentColor(row.opSolar, tOpS)}`}>{formatPercent(row.opSolar, tOpS)}</TableCell>}
                              {showEnergy && <TableCell className={`text-xs text-right py-1.5 ${percentColor(row.solar, tS)}`}>{formatPercent(row.solar, tS)}</TableCell>}
                              {showCommission && <TableCell className={`text-xs text-right py-1.5 font-medium ${percentColor(row.comissao, tC)}`}>{formatPercent(row.comissao, tC)}</TableCell>}
                            </TableRow>
                          );
                        })}
                        {showTotals && (() => {
                          const tOpE = metrics.reduce((a, m) => a + m.op_energia, 0);
                          const tE = metrics.reduce((a, m) => a + m.energia, 0);
                          const tOpS = metrics.reduce((a, m) => a + m.op_solar, 0);
                          const tS = metrics.reduce((a, m) => a + m.solar, 0);
                          const tC = metrics.reduce((a, m) => a + m.comissao, 0);
                          return (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell className="text-xs font-semibold py-1.5">TOTAL</TableCell>
                              {showEnergy && <TableCell className={`text-xs text-right font-semibold py-1.5 ${percentColor(ritmoTotals.opEnergia, tOpE)}`}>{formatPercent(ritmoTotals.opEnergia, tOpE)}</TableCell>}
                              {showEnergy && <TableCell className={`text-xs text-right font-semibold py-1.5 ${percentColor(ritmoTotals.energia, tE)}`}>{formatPercent(ritmoTotals.energia, tE)}</TableCell>}
                              {showEnergy && <TableCell className={`text-xs text-right font-semibold py-1.5 ${percentColor(ritmoTotals.opSolar, tOpS)}`}>{formatPercent(ritmoTotals.opSolar, tOpS)}</TableCell>}
                              {showEnergy && <TableCell className={`text-xs text-right font-semibold py-1.5 ${percentColor(ritmoTotals.solar, tS)}`}>{formatPercent(ritmoTotals.solar, tS)}</TableCell>}
                              {showCommission && <TableCell className={`text-xs text-right font-semibold py-1.5 ${percentColor(ritmoTotals.comissao, tC)}`}>{formatPercent(ritmoTotals.comissao, tC)}</TableCell>}
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>

      <EditMetricsModal open={editOpen} onOpenChange={setEditOpen} metrics={metrics} />
    </>
  );
}
