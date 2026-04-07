import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesCommissions } from "@/hooks/useSalesCommissions";
import { useStripeCommissions } from "@/hooks/useStripeCommissions";
import { useAuth } from "@/contexts/AuthContext";
import { Percent, TrendingUp, Receipt, RefreshCw } from "lucide-react";

export function CommissionsWidget() {
  const { data: entries, isLoading } = useSalesCommissions();
  const { data: stripeData, isLoading: stripeLoading } = useStripeCommissions();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  if (isLoading || stripeLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const myEntries = isAdmin ? (entries || []) : (entries || []).filter(e => e.userId === user?.id);
  const totalCommissions = myEntries.reduce((sum, e) => sum + e.totalCommission, 0);
  const totalSales = myEntries.reduce((sum, e) => sum + e.totalSales, 0);
  const totalCount = myEntries.reduce((sum, e) => sum + e.salesCount, 0);

  // Stripe recurring commissions
  const stripeTotal = stripeData?.grandTotal || 0;
  const stripeByUser = isAdmin 
    ? (stripeData?.byUser || []) 
    : (stripeData?.byUser || []).filter(u => u.userId === user?.id);
  const myStripeTotal = stripeByUser.reduce((s, u) => s + u.totalCommission, 0);

  const hasDirectData = myEntries.length > 0;
  const hasRecurringData = stripeByUser.length > 0;

  if (!hasDirectData && !hasRecurringData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Comissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sem dados de comissões para este período.</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Percent className="h-4 w-4" />
          Comissões
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className={`grid grid-cols-2 gap-3 ${hasRecurringData ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Vendas</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalSales)}</p>
            <p className="text-xs text-muted-foreground">{totalCount} vendas</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Comissões Diretas</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(totalCommissions)}</p>
          </div>
          {hasRecurringData && (
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <RefreshCw className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Recorrentes</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(myStripeTotal)}</p>
            </div>
          )}
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <Receipt className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(totalCommissions + myStripeTotal)}
            </p>
          </div>
        </div>

        {/* Table */}
        {isAdmin && myEntries.length > 1 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comercial</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myEntries.map((entry) => (
                <TableRow key={entry.userId}>
                  <TableCell className="font-medium">{entry.fullName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(entry.totalSales)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{entry.commissionRate}%</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatCurrency(entry.totalCommission)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
