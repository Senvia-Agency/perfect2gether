import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCommissionsDetail } from "@/hooks/useCommissionsDetail";
import { useStripeCommissions } from "@/hooks/useStripeCommissions";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Percent, RefreshCw } from "lucide-react";

interface CommissionsPayableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommissionsPayableModal({ open, onOpenChange }: CommissionsPayableModalProps) {
  const { data, isLoading } = useCommissionsDetail();
  const { data: stripeData, isLoading: stripeLoading } = useStripeCommissions();
  const [tab, setTab] = useState("direct");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Comissões a Pagar
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">Vendas Diretas</TabsTrigger>
            <TabsTrigger value="recurring" className="flex-1">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Recorrentes (Stripe)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : !data || data.byUser.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma comissão calculada para o período.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total de Comissões</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(data.grandTotal)}</span>
                </div>

                {data.byUser.map((user) => (
                  <div key={user.userId} className="rounded-lg border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                      <span className="font-medium text-sm">{user.fullName}</span>
                      <Badge variant="secondary">{formatCurrency(user.totalCommission)}</Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Venda</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {user.sales.map((sale) => (
                          <TableRow key={sale.saleId}>
                            <TableCell className="font-mono text-xs">{sale.saleCode || "—"}</TableCell>
                            <TableCell className="text-xs">{formatDate(sale.saleDate)}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(sale.totalValue)}</TableCell>
                            <TableCell className="text-right text-sm">{sale.commissionRate}%</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatCurrency(sale.commissionValue)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={2}>Subtotal</TableCell>
                          <TableCell className="text-right">{formatCurrency(user.totalSales)}</TableCell>
                          <TableCell />
                          <TableCell className="text-right">{formatCurrency(user.totalCommission)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recurring" className="mt-4">
            {stripeLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : !stripeData || stripeData.byUser.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma comissão recorrente para este mês.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Recorrente</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(stripeData.grandTotal)}</span>
                </div>

                {stripeData.byUser.map((user) => (
                  <div key={user.userId} className="rounded-lg border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                      <span className="font-medium text-sm">{user.fullName}</span>
                      <Badge variant="secondary">{formatCurrency(user.totalCommission)}</Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Valor Pago</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {user.records.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="text-sm">{record.clientOrgName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {record.plan || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(record.amount)}</TableCell>
                            <TableCell className="text-right text-sm">{record.commission_rate}%</TableCell>
                            <TableCell className="text-right text-sm font-medium">{formatCurrency(record.commission_amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={2}>Subtotal</TableCell>
                          <TableCell className="text-right">{formatCurrency(user.totalAmount)}</TableCell>
                          <TableCell />
                          <TableCell className="text-right">{formatCurrency(user.totalCommission)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
