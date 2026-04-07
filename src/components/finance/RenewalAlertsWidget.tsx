import { format, differenceInDays, isPast, isToday } from "date-fns";
import { pt } from "date-fns/locale";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format";
import { useRecurringSales, useRenewSale, useCancelRecurrence } from "@/hooks/useRecurringSales";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function RenewalAlertsWidget() {
  const { data: recurringSales = [], isLoading } = useRecurringSales();
  const renewSale = useRenewSale();
  const cancelRecurrence = useCancelRecurrence();
  const [cancelingSaleId, setCancelingSaleId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const handleRenew = async (sale: typeof recurringSales[0]) => {
    setRenewingId(sale.id);
    await renewSale.mutateAsync({
      saleId: sale.id,
      organizationId: sale.organization_id,
      amount: sale.recurring_value,
    });
    setRenewingId(null);
  };

  const handleCancel = () => {
    if (cancelingSaleId) {
      cancelRecurrence.mutate(cancelingSaleId, {
        onSettled: () => setCancelingSaleId(null),
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Renovações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recurringSales.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Renovações
          </CardTitle>
          <CardDescription>Sem renovações pendentes</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Todas as vendas recorrentes estão em dia.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Renovações Pendentes
            <Badge variant="secondary" className="ml-auto">
              {recurringSales.length}
            </Badge>
          </CardTitle>
          <CardDescription>Vendas com renovação próxima ou vencida</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1 p-4 pt-0">
              {recurringSales.map((sale) => {
                const daysUntil = differenceInDays(new Date(sale.next_renewal_date), new Date());
                const isOverdue = isPast(new Date(sale.next_renewal_date)) && !isToday(new Date(sale.next_renewal_date));
                const isDueToday = isToday(new Date(sale.next_renewal_date));
                const isRenewing = renewingId === sale.id;

                return (
                  <div
                    key={sale.id}
                    className={`p-3 rounded-lg border ${
                      isOverdue ? 'bg-red-500/5 border-red-500/20' :
                      isDueToday ? 'bg-amber-500/5 border-amber-500/20' :
                      'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isOverdue ? (
                            <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                          ) : isDueToday ? (
                            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                          ) : (
                            <RefreshCw className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="font-medium text-sm truncate">
                            {sale.client?.name || 'Cliente'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Venda {sale.code} • {formatCurrency(sale.recurring_value)}/mês
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs whitespace-nowrap ${
                          isOverdue ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                          isDueToday ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                          ''
                        }`}
                      >
                        {isOverdue 
                          ? `Vencida há ${Math.abs(daysUntil)} dias`
                          : isDueToday
                            ? 'Vence hoje'
                            : `Em ${daysUntil} dias`
                        }
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleRenew(sale)}
                        disabled={isRenewing}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isRenewing ? 'animate-spin' : ''}`} />
                        Renovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => setCancelingSaleId(sale.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelingSaleId} onOpenChange={() => setCancelingSaleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao cancelar, esta venda deixará de gerar alertas de renovação e não será mais cobrada mensalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive hover:bg-destructive/90"
            >
              Cancelar Recorrência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
