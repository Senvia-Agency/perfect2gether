import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Target, XCircle } from "lucide-react";
import { useLeadReporting, type ReportPeriod } from "@/hooks/useLeadReporting";

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  week: 'Esta semana',
  month: 'Este mês',
  quarter: 'Este trimestre',
  all: 'Todo o período',
};

export function LeadsReportPanel() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const report = useLeadReporting(period);

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Relatório de Leads</h2>
        <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Total
            </div>
            <p className="text-2xl font-bold">{report.totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3.5 w-3.5" /> Ganhas
            </div>
            <p className="text-2xl font-bold text-green-600">{report.totalWon}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <XCircle className="h-3.5 w-3.5" /> Perdidas
            </div>
            <p className="text-2xl font-bold text-red-500">{report.totalLost}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Conversão
            </div>
            <p className="text-2xl font-bold">{report.globalConversion}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Table by commercial */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Por Comercial</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Comercial</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  {report.stages.map(s => (
                    <TableHead key={s.id} className="text-center min-w-[80px]">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                        <span className="text-xs">{s.name}</span>
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Conv. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.commercials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3 + report.stages.length} className="text-center text-muted-foreground py-8">
                      Sem dados para o período selecionado
                    </TableCell>
                  </TableRow>
                ) : (
                  report.commercials.map(c => (
                    <TableRow key={c.userId}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{c.total}</Badge>
                      </TableCell>
                      {report.stages.map(s => (
                        <TableCell key={s.id} className="text-center text-sm">
                          {c.byStage[s.key] || 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Badge variant={c.conversionRate >= 30 ? "default" : "outline"}>
                          {c.conversionRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* By source */}
      {Object.keys(report.bySource).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                <Badge key={src} variant="outline" className="text-sm">
                  {src}: <span className="ml-1 font-bold">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
