import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Eye, Pencil, Trash2, Phone, Mail, Building2, MessageCircle, User } from "lucide-react";
import { CrmClient, CLIENT_STATUS_STYLES } from "@/types/clients";
import { useClientLabels } from "@/hooks/useClientLabels";
import { formatDate, getWhatsAppUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useTeamMembers } from "@/hooks/useTeam";

interface ClientsTableProps {
  clients: CrmClient[];
  onEdit: (client: CrmClient) => void;
  onView: (client: CrmClient) => void;
  onDelete: (clientId: string) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  isTelecom?: boolean;
}

export function ClientsTable({ clients, onEdit, onView, onDelete, selectedIds = [], onSelectionChange, isTelecom = false }: ClientsTableProps) {
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const { canDeleteLeads } = usePermissions();
  const { data: teamMembers = [] } = useTeamMembers();
  const labels = useClientLabels();

  const getTeamMemberName = (userId: string | null | undefined) => {
    if (!userId) return null;
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.full_name || null;
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(clients.map(c => c.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (clientId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, clientId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== clientId));
    }
  };

  const allSelected = clients.length > 0 && selectedIds.length === clients.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < clients.length;

  const handleConfirmDelete = () => {
    if (deleteClientId) {
      onDelete(deleteClientId);
      setDeleteClientId(null);
    }
  };

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Sem clientes</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Comece adicionando o seu primeiro cliente.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {onSelectionChange && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={allSelected}
                    ref={(ref) => {
                      if (ref) {
                        (ref as HTMLButtonElement).dataset.state = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked';
                      }
                    }}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
              )}
              {isTelecom ? (
                <>
                  <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                  <TableHead className="hidden md:table-cell">Contacto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden xl:table-cell">Responsável</TableHead>
                  <TableHead>{labels.statusFieldLabel}</TableHead>
                  <TableHead className="hidden sm:table-cell">Data</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Contacto</TableHead>
                  <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                  <TableHead className="hidden xl:table-cell">Responsável</TableHead>
                  <TableHead>{labels.statusFieldLabel}</TableHead>
                  <TableHead className="hidden sm:table-cell">Data</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
              const isSelected = selectedIds.includes(client.id);
              return (
                <TableRow 
                  key={client.id} 
                  className={cn(
                    "cursor-pointer",
                    isSelected && "bg-primary/5"
                  )}
                  onClick={() => onView(client)}
                >
                  {onSelectionChange && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectOne(client.id, !!checked)}
                        aria-label={`Selecionar ${client.name}`}
                      />
                    </TableCell>
                  )}
                {isTelecom ? (
                  <>
                    <TableCell className="hidden lg:table-cell">
                      {client.company ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="truncate max-w-[150px]">{client.company}</p>
                            {client.company_nif && (
                              <p className="text-xs text-muted-foreground">NIF: {client.company_nif}</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-1">
                        {client.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[180px]">{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        {client.nif && (
                          <p className="text-xs text-muted-foreground">NIF: {client.nif}</p>
                        )}
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        {client.nif && (
                          <p className="text-xs text-muted-foreground">NIF: {client.nif}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-1">
                        {client.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[180px]">{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {client.company ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="truncate max-w-[150px]">{client.company}</p>
                            {client.company_nif && (
                              <p className="text-xs text-muted-foreground">NIF: {client.company_nif}</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </TableCell>
                  </>
                )}
                <TableCell className="hidden xl:table-cell">
                  {getTeamMemberName(client.assigned_to) ? (
                    <div className="flex items-center gap-1 text-sm">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[120px]">{getTeamMemberName(client.assigned_to)}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border",
                      CLIENT_STATUS_STYLES[client.status].bg,
                      CLIENT_STATUS_STYLES[client.status].text,
                      CLIENT_STATUS_STYLES[client.status].border
                    )}
                  >
                    {{ active: labels.statusActive, inactive: labels.statusInactive, vip: labels.statusVip }[client.status]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {formatDate(client.created_at)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(client)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(client)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {client.phone && (
                        <DropdownMenuItem asChild>
                          <a
                            href={getWhatsAppUrl(client.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            WhatsApp
                          </a>
                        </DropdownMenuItem>
                      )}
                      {canDeleteLeads && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteClientId(client.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteClientId} onOpenChange={() => setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser revertida. O cliente será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
