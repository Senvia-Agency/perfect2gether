import { MiniBarChart } from "@/components/dashboard/MiniBarChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { MetricView, PortalMetric, TeamMetric } from "./portalMetricData";

const summaryItems = [
  { key: "objetivo", label: "Objetivo", tone: "hsl(var(--primary))" },
  { key: "ativos", label: "Ativos", tone: "hsl(var(--success))" },
  { key: "pendentes", label: "Pendentes", tone: "hsl(var(--warning))" },
] as const;

interface PortalMetricCardProps {
  metric: PortalMetric;
  currentView: MetricView;
  globalLabel: string;
  teamLabel: string;
  teamBreakdown: TeamMetric[];
  onOpenTeamView: () => void;
  onReturnToGlobal: () => void;
}

export function PortalMetricCard({
  metric,
  currentView,
  globalLabel,
  teamLabel,
  teamBreakdown,
  onOpenTeamView,
  onReturnToGlobal,
}: PortalMetricCardProps) {
  const isTeamView = currentView === "team";
  const chartData = summaryItems.map((item) => ({
    name: item.label,
    value: metric.summary[item.key],
  }));

  return (
    <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="space-y-4 border-b border-border/50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} aria-hidden="true" />
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Portal Total Link
              </p>
            </div>

            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold tracking-tight text-foreground">{metric.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{isTeamView ? teamLabel : globalLabel}</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: isTeamView ? "hsl(var(--foreground))" : metric.color }}
              aria-hidden="true"
            />
            {isTeamView ? "Equipa" : "Global"}
          </div>
        </div>

        {!isTeamView && (
          <p className="text-xs text-muted-foreground">Clique no gráfico para abrir a comparação por equipa.</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {isTeamView ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Vista detalhada por equipa
                </p>
                <p className="text-sm text-muted-foreground">
                  Comparação clara entre objetivo, ativos e pendentes.
                </p>
              </div>

              <button
                type="button"
                onClick={onReturnToGlobal}
                className="inline-flex items-center justify-center rounded-full border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Voltar ao Global
              </button>
            </div>

            <div className="rounded-[24px] border border-border/60 bg-background/70 p-4 sm:p-5">
              <MiniBarChart
                data={teamBreakdown}
                height={360}
                mode="grouped"
                variant="portal"
                showYAxis
                showGrid
                showLegend
                formatAsCurrency
              />
            </div>

            <div className="overflow-hidden rounded-[24px] border border-border/60 bg-background/80">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[220px]">Equipa</TableHead>
                      <TableHead className="text-right">Objetivo</TableHead>
                      <TableHead className="text-right">Ativos</TableHead>
                      <TableHead className="text-right">Pendentes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamBreakdown.map((member) => (
                      <TableRow key={member.name}>
                        <TableCell className="font-medium text-foreground">{member.name}</TableCell>
                        <TableCell className="text-right text-foreground">{formatCurrency(member.objetivo)}</TableCell>
                        <TableCell className="text-right text-foreground">{formatCurrency(member.ativos)}</TableCell>
                        <TableCell className="text-right text-foreground">{formatCurrency(member.pendentes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenTeamView}
              className="w-full rounded-[24px] border border-border/60 bg-background/70 p-4 text-left transition-colors hover:border-primary/30 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
              aria-label={`Abrir vista de equipa para ${metric.title}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Comparação atual
                  </p>
                  <p className="text-sm text-muted-foreground">Objetivo vs Ativos vs Pendentes</p>
                </div>

                <span className="inline-flex items-center rounded-full border border-border/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Ver equipa
                </span>
              </div>

              <div className="mt-4">
                <MiniBarChart
                  data={chartData}
                  color={metric.color}
                  height={240}
                  showLabels
                  variant="portal"
                  showYAxis
                  showGrid
                  formatAsCurrency
                />
              </div>
            </button>

            <div className="grid gap-3 sm:grid-cols-3">
              {summaryItems.map((item) => (
                <div key={item.key} className="rounded-[22px] border border-border/60 bg-background/70 p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.tone }} aria-hidden="true" />
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: item.tone }}>
                    {metric.summary[item.key]}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
