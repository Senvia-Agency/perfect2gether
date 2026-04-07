import { useState } from 'react';
import { usePersistedState } from "@/hooks/usePersistedState";

import { useAuth } from "@/contexts/AuthContext";
import { useProposals, useUpdateProposal } from '@/hooks/useProposals';
import { useProposalsRealtime } from '@/hooks/useRealtimeSubscription';
import { TeamMemberFilter } from '@/components/dashboard/TeamMemberFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Filter, Plus, Zap, Wrench } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { ProposalDetailsModal } from '@/components/proposals/ProposalDetailsModal';
import { CreateProposalModal } from '@/components/proposals/CreateProposalModal';
import { 
  PROPOSAL_STATUS_LABELS, 
  PROPOSAL_STATUS_COLORS, 
  PROPOSAL_STATUSES,
  PROPOSAL_TYPE_LABELS,
} from '@/types/proposals';
import type { Proposal, ProposalStatus, ProposalType } from '@/types/proposals';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTelecomProposalMetrics } from '@/hooks/useTelecomProposalMetrics';
import { pt } from 'date-fns/locale';

export default function Proposals() {
  // Subscribe to realtime updates
  useProposalsRealtime();
  const { profile, organization } = useAuth();
  const { data: proposals = [], isLoading } = useProposals();
  const isTelecom = organization?.niche === 'telecom';
  const { data: telecomMetrics } = useTelecomProposalMetrics();
  
  const [search, setSearch] = usePersistedState('proposals-search-v1', '');
  const [statusFilter, setStatusFilter] = usePersistedState<ProposalStatus | 'all'>('proposals-status-v1', 'all');
  const [typeFilter, setTypeFilter] = usePersistedState<'all' | 'energia' | 'servicos'>('proposals-type-v1', 'all');
  const [dateRange, setDateRange] = usePersistedState<DateRange | undefined>('proposals-date-range-v1', undefined);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const filteredProposals = proposals.filter((proposal) => {
    // Hide proposals that already have a sale created (telecom)
    if (isTelecom && (proposal as any).has_sale) return false;
    
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || 
      proposal.client?.name?.toLowerCase().includes(searchLower) ||
      proposal.lead?.name?.toLowerCase().includes(searchLower) ||
      proposal.code?.toLowerCase().includes(searchLower) ||
      proposal.notes?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'all' || proposal.status === statusFilter;
    const matchesType = typeFilter === 'all' || proposal.proposal_type === typeFilter;
    const proposalDate = new Date(proposal.proposal_date);
    const matchesDate = !dateRange?.from || (
      proposalDate >= dateRange.from &&
      (!dateRange.to || proposalDate <= dateRange.to)
    );
    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  // Group proposals by status for summary (use filtered)
  const proposalsByStatus = PROPOSAL_STATUSES.reduce((acc, status) => {
    acc[status] = filteredProposals.filter(p => p.status === status);
    return acc;
  }, {} as Record<ProposalStatus, Proposal[]>);

  const totalValue = filteredProposals.reduce((sum, p) => sum + Number(p.total_value), 0);
  const pendingValue = filteredProposals
    .filter(p => ['sent', 'negotiating'].includes(p.status))
    .reduce((sum, p) => sum + Number(p.total_value), 0);

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Propostas
            </h1>
            <p className="text-muted-foreground">Gestão de propostas comerciais.</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Proposta
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Propostas</p>
              <p className="text-2xl font-bold">{filteredProposals.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalValue)}</p>
              {isTelecom && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(telecomMetrics?.totalMWh ?? 0).toFixed(1)} MWh · {(telecomMetrics?.totalKWp ?? 0).toFixed(1)} kWp
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Em Negociação</p>
              <p className="text-2xl font-bold text-amber-500">{formatCurrency(pendingValue)}</p>
              {isTelecom && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(telecomMetrics?.pendingMWh ?? 0).toFixed(1)} MWh · {(telecomMetrics?.pendingKWp ?? 0).toFixed(1)} kWp
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Aceites</p>
              <p className="text-2xl font-bold text-green-500">{proposalsByStatus.accepted?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Período"
            className="w-full sm:w-auto"
          />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por cliente, empresa ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <TeamMemberFilter className="w-full sm:w-[180px]" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProposalStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {PROPOSAL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {PROPOSAL_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isTelecom && (
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'energia' | 'servicos')}>
              <SelectTrigger className="w-full sm:w-48">
                <Zap className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="energia">Energia</SelectItem>
                <SelectItem value="servicos">Outros Serviços</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>


        {/* Proposals List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredProposals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {proposals.length === 0
                  ? 'Ainda não existem propostas.'
                  : 'Nenhuma proposta corresponde aos filtros.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredProposals.map((proposal) => (
              <Card
                key={proposal.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedProposal(proposal)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={cn('text-xs', PROPOSAL_STATUS_COLORS[proposal.status])}>
                        {PROPOSAL_STATUS_LABELS[proposal.status]}
                      </Badge>
                      {proposal.proposal_type && (
                        <Badge className={cn('text-xs', proposal.proposal_type === 'energia' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-violet-500/20 text-violet-400')}>
                          {proposal.proposal_type === 'energia' ? <Zap className="h-3 w-3 mr-1" /> : <Wrench className="h-3 w-3 mr-1" />}
                          {PROPOSAL_TYPE_LABELS[proposal.proposal_type]}
                        </Badge>
                      )}
                      {proposal.code && (
                        <span className="text-xs font-mono text-primary font-medium">
                          {proposal.code}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(proposal.proposal_date), "d MMM yyyy", { locale: pt })}
                      </span>
                    </div>
                    <p className="font-medium truncate">{proposal.client?.name || proposal.lead?.name || 'Proposta Avulsa'}</p>
                    {proposal.notes && (
                      <p className="text-sm text-muted-foreground truncate">{proposal.notes}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(proposal.total_value)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateProposalModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={(proposal) => setSelectedProposal(proposal)}
      />

      {selectedProposal && (
        <ProposalDetailsModal
          proposal={selectedProposal}
          open={!!selectedProposal}
          onOpenChange={(open) => !open && setSelectedProposal(null)}
        />
      )}
    </>
  );
}
