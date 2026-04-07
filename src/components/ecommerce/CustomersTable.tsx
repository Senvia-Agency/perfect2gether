import { useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Users, Plus, Edit, Trash2, Mail, Phone } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import { useCustomers, useDeleteCustomer } from "@/hooks/ecommerce";
import { formatCurrency } from "@/lib/format";
import { Customer } from "@/types/ecommerce";
import { CreateCustomerModal } from "./CreateCustomerModal";
import { EditCustomerModal } from "./EditCustomerModal";

export function CustomersTable() {
  const { data: customers, isLoading } = useCustomers();
  const deleteCustomer = useDeleteCustomer();
  
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredCustomers = customers?.filter((customer) => {
    const searchLower = search.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      customer.phone?.toLowerCase().includes(searchLower)
    );
  });

  const handleDelete = () => {
    if (deleteId) {
      deleteCustomer.mutate(deleteId);
      setDeleteId(null);
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Pesquisar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-[300px]"
          />
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {filteredCustomers?.length || 0} clientes
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {filteredCustomers?.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8">
          <Users className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">Sem clientes</h3>
          <p className="text-sm text-muted-foreground">
            {search ? "Nenhum cliente encontrado." : "Adicione o seu primeiro cliente."}
          </p>
          {!search && (
            <Button onClick={() => setCreateOpen(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Total Gasto</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      {customer.accepts_marketing && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          Marketing
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </div>
                      {customer.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{customer.total_orders ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(customer.total_spent ?? 0)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(customer.created_at), "MMM yyyy", { locale: pt })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditCustomer(customer)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(customer.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modals */}
      <CreateCustomerModal open={createOpen} onOpenChange={setCreateOpen} />
      
      {editCustomer && (
        <EditCustomerModal
          customer={editCustomer}
          open={!!editCustomer}
          onOpenChange={(open) => !open && setEditCustomer(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar este cliente? Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
