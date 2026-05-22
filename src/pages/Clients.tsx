import { useState, useMemo, useEffect } from "react";

import { useSearchParams, useLocation } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useAuth } from "@/contexts/AuthContext";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Users, Crown, UserMinus, Euro, Shield, Loader2 } from "lucide-react";
import { useClients, useClientStats, useDeleteClient } from "@/hooks/useClients";
import { useClientLabels } from "@/hooks/useClientLabels";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { CreateClientModal } from "@/components/clients/CreateClientModal";
import { EditClientModal } from "@/components/clients/EditClientModal";
import { ClientDetailsDrawer } from "@/components/clients/ClientDetailsDrawer";
import { ClientFilters, defaultFilters, type ClientFiltersState } from "@/components/clients/ClientFilters";
import { BulkActionsBar } from "@/components/shared/BulkActionsBar";
import { AssignTeamMemberModal } from "@/components/shared/AssignTeamMemberModal";
import type { CrmClient } from "@/types/clients";
import { formatCurrency } from "@/lib/format";
import { mapClientsForExport, exportToCsv, exportToExcel } from "@/lib/export";
import { useClientProposalTypes } from "@/hooks/useClientProposalTypes";
import { CreateProposalModal } from "@/components/proposals/CreateProposalModal";
import { toast } from "sonner";
import { useModules } from "@/hooks/useModules";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { read, utils } from "xlsx";
import { importClients } from "@/lib/clients/import";
import { useTeamMembers } from "@/hooks/useTeam";
import { useTeamFilter } from "@/hooks/useTeamFilter";
import { useQueryClient } from "@tanstack/react-query";
import { hasPerfect2GetherAccess } from "@/lib/perfect2gether";

export default function Clients() {
  const { profile, organization, organizations, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = usePersistedState("clients-search-v1", "");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CrmClient | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [filters, setFilters] = usePersistedState<ClientFiltersState>("clients-filters-v2", defaultFilters);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [proposalClientId, setProposalClientId] = useState<string | null>(null);

  const { data: clients, isLoading } = useClients();
  const { stats } = useClientStats();
  const deleteClient = useDeleteClient();
  const labels = useClientLabels();
  const { clientTypesMap, isTelecom } = useClientProposalTypes();
  const { modules } = useModules();
  const showEnergy = isTelecom && modules.energy;
  const [isImporting, setIsImporting] = useState(false);
  const { data: teamMembers } = useTeamMembers();
  const { canFilterByTeam } = useTeamFilter();
  const queryClient = useQueryClient();
  const isPerfect2Gether = hasPerfect2GetherAccess({
    organizationId: organization?.id,
    memberships: organizations,
    isSuperAdmin,
  });

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    
    return clients.filter((client) => {
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          client.name.toLowerCase().includes(searchLower) ||
          client.email?.toLowerCase().includes(searchLower) ||
          client.phone?.includes(search) ||
          client.company?.toLowerCase().includes(searchLower) ||
          client.code?.toLowerCase().includes(searchLower) ||
          client.nif?.includes(search);
        
        if (!matchesSearch) return false;
      }

      if (filters.status !== 'all' && client.status !== filters.status) {
        return false;
      }

      // O filtro por colaborador só se aplica a quem pode ver dados de outros.
      // Para um comercial os dados já vêm restritos do useClients — ignorar valor persistido obsoleto.
      if (canFilterByTeam && filters.assignedTo !== 'all' && client.assigned_to !== filters.assignedTo) {
        return false;
      }

      if (filters.dateFrom || filters.dateTo) {
        const clientDate = parseISO(client.created_at);
        const from = filters.dateFrom ? startOfDay(filters.dateFrom) : new Date(0);
        const to = filters.dateTo ? endOfDay(filters.dateTo) : new Date(2100, 11, 31);
        
        if (!isWithinInterval(clientDate, { start: from, end: to })) {
          return false;
        }
      }

      // Proposal type filter (telecom)
      if (filters.proposalType !== 'all') {
        const types = clientTypesMap[client.id];
        if (!types || !types.includes(filters.proposalType)) {
          return false;
        }
      }

      return true;
    });
  }, [clients, search, filters, clientTypesMap, canFilterByTeam]);

  const handleEdit = (client: CrmClient) => {
    setSelectedClient(client);
    setShowDetailsDrawer(false);
    setShowEditModal(true);
  };

  const handleView = (client: CrmClient) => {
    setSelectedClient(client);
    setShowDetailsDrawer(true);
  };

  const handleDelete = (clientId: string) => {
    deleteClient.mutate(clientId);
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
  };

  useEffect(() => {
    setSelectedIds([]);
  }, [search, filters]);

  // Auto-open client drawer from URL param (e.g. from dashboard widget)
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && clients && clients.length > 0) {
      const client = clients.find(c => c.id === highlightId);
      if (client) {
        handleView(client);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, clients]);

  // Auto-open client drawer from location state (e.g. from Lead â†’ Won flow)
  useEffect(() => {
    const openClientId = (location.state as any)?.openClientId;
    if (openClientId && clients && clients.length > 0) {
      const client = clients.find(c => c.id === openClientId);
      if (client) {
        handleView(client);
      }
      // Clear state to prevent re-opening on re-render
      window.history.replaceState({}, document.title);
    }
  }, [location.state, clients]);

  const handleAssignSuccess = () => {
    setSelectedIds([]);
    setShowAssignModal(false);
  };

  const handleExportCsv = () => {
    const selectedClients = filteredClients.filter(c => selectedIds.includes(c.id));
    const data = mapClientsForExport(selectedClients, organization?.niche === 'telecom');
    exportToCsv(data, `clientes_${format(new Date(), 'yyyy-MM-dd')}`);
    toast.success(`${selectedClients.length} clientes exportados para CSV`);
  };

  const handleImportClick = () => {
    const input = document.getElementById('clients-import-input');
    if (input) input.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization || !profile) return;

    setIsImporting(true);
    const toastId = toast.loading("A processar ficheiro...");

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = read(bstr, { type: 'binary', cellDates: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = utils.sheet_to_json(ws);

          if (data.length === 0) {
            toast.error("O ficheiro está vazio.", { id: toastId });
            setIsImporting(false);
            return;
          }

          toast.loading(`A importar ${data.length} registos...`, { id: toastId });

          const result = await importClients(
            data as Record<string, unknown>[],
            organization.id,
            profile.id,
            teamMembers || [],
            (current, total) => {
              toast.loading(`A importar: ${current}/${total}...`, { id: toastId });
            }
          );

          if (result.failed === 0) {
            toast.success(`Importação concluída! ${result.inserted} clientes criados/atualizados.`, { id: toastId });
          } else {
            toast.warning(`Importação com avisos. Sucesso: ${result.inserted}, Falhas: ${result.failed}.`, {
              id: toastId,
              description: result.errors[0],
            });
          }

          queryClient.invalidateQueries({ queryKey: ['clients'] });
          queryClient.invalidateQueries({ queryKey: ['cpes'] });
        } catch (err: any) {
          toast.error(`Erro ao processar dados: ${err.message}`, { id: toastId });
        } finally {
          setIsImporting(false);
          e.target.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast.error(`Erro ao ler ficheiro: ${error.message}`, { id: toastId });
      setIsImporting(false);
    }
  };

  const handleExportExcel = () => {
    const selectedClients = filteredClients.filter(c => selectedIds.includes(c.id));
    const data = mapClientsForExport(selectedClients, organization?.niche === 'telecom');
    exportToExcel(data, `clientes_${format(new Date(), 'yyyy-MM-dd')}`);
    toast.success(`${selectedClients.length} clientes exportados para Excel`);
  };

  return (
    <>
      <SEO 
        title={`${labels.plural} | Perfect2Gether`}
        description={`Gestão de ${labels.plural.toLowerCase()} CRM`}
      />
      
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{labels.plural}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestão de {labels.plural.toLowerCase()} e relacionamento comercial
            </p>
          </div>
          <div className="flex gap-2">
            {isPerfect2Gether && (
              <>
                <input
                  type="file"
                  id="clients-import-input"
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                />
                <Button variant="outline" size="sm" onClick={handleImportClick} disabled={isImporting}>
                  {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Importar
                </Button>
              </>
            )}
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {labels.new}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{labels.total}</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{labels.active}</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Crown className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{labels.vip}</p>
                  <p className="text-2xl font-bold">{stats.vip}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <UserMinus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{labels.inactive}</p>
                  <p className="text-2xl font-bold">{stats.inactive}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {organization?.niche === 'telecom' ? (
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <Euro className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Comissão Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalComissao)}</p>
                    {showEnergy && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.totalMwh.toFixed(1)} MWh
                        {!isPerfect2Gether && ` · ${stats.totalKwp.toFixed(1)} kWp`}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <Euro className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search & Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Pesquisar por nome, email, telefone, empresa ou NIF...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <ClientFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
            isTelecom={showEnergy}
            teamMembers={teamMembers ?? []}
          />
        </div>

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={selectedIds.length}
          onAssignTeamMember={() => setShowAssignModal(true)}
          onExportCsv={handleExportCsv}
          onExportExcel={handleExportExcel}
          onClearSelection={() => setSelectedIds([])}
          entityLabel="clientes selecionados"
        />

        {/* Table */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ClientsTable
            clients={filteredClients}
            onEdit={handleEdit}
            onView={handleView}
            onDelete={handleDelete}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            isTelecom={showEnergy}
          />
        )}
      </div>

      {/* Modals */}
      <CreateClientModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      <EditClientModal
        client={selectedClient}
        open={showEditModal}
        onOpenChange={setShowEditModal}
      />

      <ClientDetailsDrawer
        client={selectedClient}
        open={showDetailsDrawer}
        onOpenChange={setShowDetailsDrawer}
        onEdit={handleEdit}
        onNewProposal={(client) => {
          setProposalClientId(client.id);
          setShowCreateProposal(true);
        }}
      />

      <CreateProposalModal
        open={showCreateProposal}
        onOpenChange={setShowCreateProposal}
        preselectedClientId={proposalClientId ?? undefined}
      />

      <AssignTeamMemberModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        selectedIds={selectedIds}
        entityType="clients"
        onSuccess={handleAssignSuccess}
      />
    </>
  );
}
