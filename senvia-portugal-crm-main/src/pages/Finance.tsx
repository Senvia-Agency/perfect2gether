import { usePersistedState } from "@/hooks/usePersistedState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  TrendingUp,
  Clock,
  CalendarDays,
  TrendingDown,
  Scale,
  ExternalLink,
  AlertTriangle,
  Percent,
} from "lucide-react";
import { useFinanceStats } from "@/hooks/useFinanceStats";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { InvoicesContent } from "@/components/finance/InvoicesContent";
import InternalRequests from "@/pages/finance/InternalRequests";
import { BankAccountsTab } from "@/components/finance/BankAccountsTab";
import { CommissionsTab } from "@/components/finance/CommissionsTab";
import { CommissionAnalysisTab } from "@/components/finance/CommissionAnalysisTab";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useSalesCommissions } from "@/hooks/useSalesCommissions";
import { CommissionsPayableModal } from "@/components/finance/CommissionsPayableModal";
import { RenewalAlertsWidget } from "@/components/finance/RenewalAlertsWidget";
import { hasPerfect2GetherAccess } from "@/lib/perfect2gether";
import { usePermissions } from "@/hooks/usePermissions";

export default function Finance() {
  const { organization, organizations } = useAuth();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const isTelecom = organization?.niche === "telecom";
  const salesSettings = (organization?.sales_settings as { commissions_enabled?: boolean }) || {};
  const commissionsEnabled = !!salesSettings.commissions_enabled;
  const canViewCommissionAnalysis = hasPerfect2GetherAccess({
    organizationId: organization?.id,
    memberships: organizations,
    isSuperAdmin,
  }) && isAdmin;
  const validTabs = isTelecom
    ? ["outros", "comissoes", ...(canViewCommissionAnalysis ? ["analise-comissoes"] : [])]
    : ["resumo", "contas", "faturas", "outros", ...(canViewCommissionAnalysis ? ["analise-comissoes"] : [])];
  const [dateRange, setDateRange] = usePersistedState<DateRange | undefined>("finance-daterange-v1", undefined);
  const [activeTab, setActiveTab] = usePersistedState("finance-tab-v1", isTelecom ? "outros" : "resumo");
  const [commissionsModalOpen, setCommissionsModalOpen] = useState(false);
  const { data: commissionsData } = useSalesCommissions();

  useEffect(() => {
    if (organization && !validTabs.includes(activeTab)) {
      setActiveTab(validTabs[0]);
    }
  }, [organization, activeTab, setActiveTab, validTabs]);

  const { stats, isLoading } = useFinanceStats({ dateRange });
  const navigate = useNavigate();

  const chartData = stats.cashflowTrend.map((point) => ({
    ...point,
    dateLabel: format(parseISO(point.date), "dd MMM", { locale: pt }),
  }));

  const hasFilters = dateRange?.from !== undefined;

  return (
    <div className="space-y-6 p-4 pb-20 md:p-6 md:pb-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Visão geral das finanças da sua empresa</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          {!isTelecom && <TabsTrigger value="resumo">Resumo</TabsTrigger>}
          {!isTelecom && <TabsTrigger value="contas">Contas</TabsTrigger>}
          {!isTelecom && <TabsTrigger value="faturas">Faturas</TabsTrigger>}
          <TabsTrigger value="outros">Outros</TabsTrigger>
          {isTelecom && <TabsTrigger value="comissoes">Comissões</TabsTrigger>}
          {canViewCommissionAnalysis && <TabsTrigger value="analise-comissoes">Análise de Comissões</TabsTrigger>}
        </TabsList>

        <TabsContent value="resumo" className="mt-0 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-muted-foreground">Período:</span>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Todo o histórico"
                  className="w-full sm:w-auto"
                />
                {hasFilters && (
                  <span className="text-xs text-muted-foreground">(dados filtrados pelo período selecionado)</span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Faturado</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-xl font-bold md:text-2xl">{formatCurrency(stats.totalBilled)}</div>
                )}
                <p className="text-xs text-muted-foreground">{hasFilters ? "No período" : "Histórico total"}</p>
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate("/financeiro/pagamentos?status=paid")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recebido</CardTitle>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-xl font-bold text-emerald-600 md:text-2xl">{formatCurrency(stats.totalReceived)}</div>
                )}
                <p className="text-xs text-muted-foreground">{hasFilters ? "No período" : "Total recebido"}</p>
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate("/financeiro/pagamentos?status=pending")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendente</CardTitle>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-xl font-bold text-amber-600 md:text-2xl">{formatCurrency(stats.totalPending)}</div>
                )}
                <p className="text-xs text-muted-foreground">Saldo global por receber</p>
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate("/financeiro/pagamentos?status=overdue")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-xl font-bold text-orange-600 md:text-2xl">{formatCurrency(stats.totalOverdue)}</div>
                )}
                <p className="text-xs text-muted-foreground">{stats.overdueCount} pagamento(s)</p>
              </CardContent>
            </Card>

            <Card
              className="group cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate("/financeiro/despesas")}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesas</CardTitle>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-xl font-bold text-destructive md:text-2xl">{formatCurrency(stats.totalExpenses)}</div>
                )}
                <p className="text-xs text-muted-foreground">{hasFilters ? "No período" : "Total"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balanço</CardTitle>
                <Scale className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className={`text-xl font-bold md:text-2xl ${stats.balance >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatCurrency(stats.balance)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Recebido - Despesas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">A Vencer (7 dias)</CardTitle>
                <CalendarDays className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-xl font-bold text-blue-600 md:text-2xl">{formatCurrency(stats.dueSoon)}</div>
                )}
                <p className="text-xs text-muted-foreground">{stats.dueSoonCount} pagamento(s)</p>
              </CardContent>
            </Card>

            {commissionsEnabled && (
              <Card
                className="group cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => setCommissionsModalOpen(true)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comissões a Pagar</CardTitle>
                  <div className="flex items-center gap-1">
                    <Percent className="h-4 w-4 text-primary" />
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-primary md:text-2xl">
                    {formatCurrency(commissionsData?.reduce((sum, commission) => sum + commission.totalCommission, 0) || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Total do período</p>
                </CardContent>
              </Card>
            )}
          </div>

          <CommissionsPayableModal open={commissionsModalOpen} onOpenChange={setCommissionsModalOpen} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Fluxo de Caixa {hasFilters ? "(período selecionado)" : "(últimos 30 dias)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorScheduled" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `€${value}`}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => label}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="received"
                        name="Recebido"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorReceived)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="scheduled"
                        name="Agendado"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorScheduled)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="overdue"
                        name="Atrasados"
                        stroke="#f97316"
                        fillOpacity={1}
                        fill="url(#colorOverdue)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        name="Despesas"
                        stroke="#ef4444"
                        fillOpacity={0.3}
                        fill="#ef4444"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <RenewalAlertsWidget />
          </div>
        </TabsContent>

        <TabsContent value="contas" className="mt-0">
          <BankAccountsTab />
        </TabsContent>

        <TabsContent value="faturas" className="mt-0">
          <InvoicesContent />
        </TabsContent>

        <TabsContent value="outros" className="mt-0">
          <InternalRequests />
        </TabsContent>

        {isTelecom && (
          <TabsContent value="comissoes" className="mt-0">
            <CommissionsTab />
          </TabsContent>
        )}

        {canViewCommissionAnalysis && (
          <TabsContent value="analise-comissoes" className="mt-0">
            <CommissionAnalysisTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
