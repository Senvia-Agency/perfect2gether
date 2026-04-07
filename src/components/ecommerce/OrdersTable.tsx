import { useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { ShoppingCart, Eye, Truck, CreditCard } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrders, useUpdateOrderStatus } from "@/hooks/ecommerce";
import { formatCurrency } from "@/lib/format";
import {
  Order,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  FULFILLMENT_STATUS_LABELS,
} from "@/types/ecommerce";
import { OrderDetailsModal } from "./OrderDetailsModal";

const statusColors: Record<OrderStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  processing: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  shipped: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  delivered: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
};

const paymentColors: Record<PaymentStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600",
  paid: "bg-green-500/10 text-green-600",
  refunded: "bg-blue-500/10 text-blue-600",
  failed: "bg-red-500/10 text-red-600",
};

export function OrdersTable() {
  const { data: orders, isLoading } = useOrders();
  const updateStatus = useUpdateOrderStatus();
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredOrders = orders?.filter((order) => {
    if (statusFilter === "all") return true;
    return order.status === statusFilter;
  });

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    updateStatus.mutate({ orderId, status });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {filteredOrders?.length || 0} pedidos
          </p>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredOrders?.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8">
          <ShoppingCart className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">Sem pedidos</h3>
          <p className="text-sm text-muted-foreground">
            Os pedidos aparecerão aqui quando os clientes comprarem.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Expedição</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                      {order.order_number}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), "d MMM yyyy", { locale: pt })}
                  </TableCell>
                  <TableCell>
                    {order.customer?.name || (
                      <span className="text-muted-foreground">Cliente anónimo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.id, value as OrderStatus)}
                    >
                      <SelectTrigger className="h-7 w-[130px] border-0 p-0">
                        <Badge className={statusColors[order.status as OrderStatus]} variant="outline">
                          {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge className={paymentColors[order.payment_status as PaymentStatus]}>
                      <CreditCard className="mr-1 h-3 w-3" />
                      {PAYMENT_STATUS_LABELS[order.payment_status as PaymentStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <Truck className="mr-1 h-3 w-3" />
                      {FULFILLMENT_STATUS_LABELS[order.fulfillment_status as FulfillmentStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedOrder(order)}
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
