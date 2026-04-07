import { useState, useEffect } from "react";
import { isPerfect2GetherOrg } from "@/lib/perfect2gether";
import { useNavigate } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePermissions } from "@/hooks/usePermissions";

import { ResponsiveKanban } from "@/components/leads/ResponsiveKanban";
import { LeadsTableView } from "@/components/leads/LeadsTableView";
import { LeadDetailsModal } from "@/components/leads/LeadDetailsModal";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { CreateEventModal } from "@/components/calendar/CreateEventModal";
import { EventDetailsModal } from "@/components/calendar/EventDetailsModal";
import { CreateProposalModal } from "@/components/proposals/CreateProposalModal";
import { ProposalDetailsModal } from "@/components/proposals/ProposalDetailsModal";
import { CreateClientModal } from "@/components/clients/CreateClientModal";
import { CreateSaleModal } from "@/components/sales/CreateSaleModal";
import { LostLeadDialog } from "@/components/leads/LostLeadDialog";

import { TeamMemberFilter } from "@/components/dashboard/TeamMemberFilter";
import { BulkActionsBar } from "@/components/shared/BulkActionsBar";
import { AssignTeamMemberModal } from "@/components/shared/AssignTeamMemberModal";
import { useAuth } from "@/contexts/AuthContext";
import { useProposals } from "@/hooks/useProposals";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import type { Proposal } from "@/types/proposals";
import type { CalendarEvent } from "@/types/calendar";
import { useLeads, useUpdateLeadStatus, useDeleteLead, useUpdateLead } from "@/hooks/useLeads";
import { useClients, useConvertLeadToClient } from "@/hooks/useClients";
import { useLeadsRealtime, useProposalsRealtime } from "@/hooks/useRealtimeSubscription";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Loader2, X, Plus, LayoutGrid, List, Zap, BarChart3 } from "lucide-react";
import { format, endOfDay, startOfDay } from "date-fns";
import { normalizeString } from "@/lib/utils";
import { mapLeadsForExport, exportToCsv, exportToExcel } from "@/lib/export";
import { toast } from "sonner";
import type { Lead, LeadTemperature, LeadTipologia } from "@/types";
import { TIPOLOGIA_LABELS } from "@/types";
import { LeadsReportPanel } from "@/components/leads/LeadsReportPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModules } from "@/hooks/useModules";

export default function Leads() {
  // Subscribe to realtime updates
  useLeadsRealtime();
  useProposalsRealtime();
  const { user, profile, organization } = useAuth();
  const { isAdmin } = usePermissions();
  const { data: leads = [], isLoading } = useLeads();
  const { data: proposals = [] } = useProposals();
  const { data: clients = [] } = useClients();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const { data: stages = [] } = usePipelineStages();
  const updateStatus = useUpdateLeadStatus();
  const deleteLead = useDeleteLead();
  const updateLead = useUpdateLead();
  const convertLeadToClient = useConvertLeadToClient();
  const navigate = useNavigate();
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isCreateProposalModalOpen, setIsCreateProposalModalOpen] = useState(false);
  const [isProposalDetailsModalOpen, setIsProposalDetailsModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [isEventDetailsModalOpen, setIsEventDetailsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [pendingLead, setPendingLead] = useState<Lead | null>(null);
  
  // Lost lead dialog state
  const [isLostDialogOpen, setIsLostDialogOpen] = useState(false);
  const [pendingLostStatus, setPendingLostStatus] = useState<{ leadId: string; status: string } | null>(null);
  const queryClient = useQueryClient();
  
  // New states for the chained client -> proposal flow
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
  const [newlyCreatedClientId, setNewlyCreatedClientId] = useState<string | null>(null);
  const [isChainedFlow, setIsChainedFlow] = useState(false);
  const [isCreateSaleModalOpen, setIsCreateSaleModalOpen] = useState(false);
  const [prefillSaleClientId, setPrefillSaleClientId] = useState<string | null>(null);
  const [prefillProposalClientId, setPrefillProposalClientId] = useState<string | null>(null);
  const [prefillSaleClient, setPrefillSaleClient] = useState<{
    id: string;
    name: string;
    code?: string | null;
    email?: string | null;
    nif?: string | null;
    address_line1?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null>(null);
  const [pendingWonData, setPendingWonData] = useState<{ leadId: string; status: string } | null>(null);
  const [searchQuery, setSearchQuery] = usePersistedState("leads-search-v1", "");
  const [statusFilter, setStatusFilter] = usePersistedState<string[]>("leads-status-v1", []);
  const [dateRange, setDateRange] = usePersistedState<{ from?: Date; to?: Date }>("leads-daterange-v1", { from: undefined, to: undefined });
  const isTelecom = organization?.niche === 'telecom';
  const { modules } = useModules();
  const showEnergy = isTelecom && modules.energy;
  const [tipologiaFilter, setTipologiaFilter] = usePersistedState<'all' | LeadTipologia>('leads-tipologia-v1', 'all');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(() => {
    const saved = localStorage.getItem('leads-view-mode');
    return (saved === 'table' || saved === 'kanban') ? saved : 'kanban';
  });
  const [activeTab, setActiveTab] = useState<'pipeline' | 'report'>('pipeline');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('leads-view-mode', viewMode);
  }, [viewMode]);

  // Keep selectedLead synchronized with updated data from query
  useEffect(() => {
    if (selectedLead && leads.length > 0) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        setSelectedLead(updatedLead);
      }
    }
  }, [leads]);

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter([]);
    setDateRange({ from: undefined, to: undefined });
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [searchQuery, statusFilter, dateRange]);

  const hasActiveFilters = searchQuery || statusFilter.length > 0 || dateRange.from || dateRange.to;

  const filteredLeads = leads.filter(lead => {
    // 1. Pesquisa accent-insensitive
    const query = normalizeString(searchQuery);
    const matchesSearch = query === "" || 
      normalizeString(lead.name).includes(query) ||
      normalizeString(lead.email).includes(query) ||
      lead.phone.includes(searchQuery);
    
    // 2. Filtro de status
    const matchesStatus = statusFilter.length === 0 || 
      statusFilter.includes(lead.status || '');
    
    // 3. Filtro de data
    const leadDate = lead.created_at ? new Date(lead.created_at) : null;
    const fromDate = dateRange.from ? startOfDay(dateRange.from) : null;
    const toDate = dateRange.to ? endOfDay(dateRange.to) : null;
    const matchesDate =
      (!fromDate || (leadDate && leadDate >= fromDate)) &&
      (!toDate || (leadDate && leadDate <= toDate));
    
    const matchesTipologia = tipologiaFilter === 'all' || lead.tipologia === tipologiaFilter;
    
    return matchesSearch && matchesStatus && matchesDate && matchesTipologia;
  });

  // Check if a stage is of a special type (scheduled or proposal-like)
  const isScheduledStage = (stageKey: string) => {
    const stage = stages.find(s => s.key === stageKey);
    // Check if the stage name contains keywords that indicate it's a scheduling stage
    const scheduledKeywords = ['agendado', 'scheduled', 'reunião', 'meeting', 'consulta'];
    return stage && scheduledKeywords.some(kw => stage.name.toLowerCase().includes(kw));
  };

  const isProposalStage = (stageKey: string) => {
    const stage = stages.find(s => s.key === stageKey);
    const proposalKeywords = ['proposta', 'proposal', 'orçamento', 'quote'];
    return stage && proposalKeywords.some(kw => stage.name.toLowerCase().includes(kw));
  };

  // Check if a status is final (won/lost)
  const isFinalStatus = (status: string) => {
    const stage = stages.find(s => s.key === status);
    return stage?.is_final_positive || stage?.is_final_negative || false;
  };

  const isLostStage = (stageKey: string) => {
    const stage = stages.find(s => s.key === stageKey);
    if (stage?.is_final_negative) return true;
    const lostKeywords = ['perdido', 'lost', 'cancelado', 'cancelled'];
    return stage && lostKeywords.some(kw => stage.name.toLowerCase().includes(kw));
  };

  const isWonStage = (stageKey: string) => {
    const stage = stages.find(s => s.key === stageKey);
    if (stage?.is_final_positive) return true;
    const wonKeywords = ['ganho', 'won', 'fechado', 'closed'];
    return stage && wonKeywords.some(kw => stage.name.toLowerCase().includes(kw));
  };

  const handleStatusChange = (leadId: string, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    
    // Block status change on final leads for non-admins
    if (lead && isFinalStatus(lead.status || '')) {
      if (!isAdmin) {
        toast.error('Apenas administradores podem alterar o estado de leads finalizadas.');
        return;
      }
    }
    
    // Intercept drops on scheduling stages -> open event modal (create or view existing)
    if (isScheduledStage(newStatus)) {
      // Check if lead already has a pending/active event
      const existingEvent = calendarEvents.find(
        e => e.lead_id === leadId && e.status !== 'cancelled' && e.status !== 'completed'
      );

      if (existingEvent) {
        // If the lead already has an event, we still want the drop action
        // to actually move the lead to the chosen stage.
        if (!lead || lead.status !== newStatus) {
          updateStatus.mutate({ leadId, status: newStatus });
        }

        // Open event details modal
        setSelectedEvent(existingEvent);
        setIsEventDetailsModalOpen(true);
      } else {
        // Open create event modal
        setPendingLead(lead || null);
        setIsCreateEventModalOpen(true);
      }
      return;
    }
    
    // Intercept drops on proposal stages -> open client modal first (then proposal)
    if (isProposalStage(newStatus)) {
      // Check if lead already has a proposal (by lead_id)
      const existingProposal = proposals.find(p => p.lead_id === leadId);
      
      if (existingProposal) {
        // Open edit modal
        setSelectedProposal(existingProposal);
        setIsProposalDetailsModalOpen(true);
        // Also update status
        updateStatus.mutate({ leadId, status: newStatus });
        return;
      }
      
      // Check if lead already has a client
      const existingClient = clients.find(c => c.lead_id === leadId);
      
      if (existingClient) {
        // Check for proposals linked to this client (fallback)
        const clientProposal = proposals.find(p => p.client_id === existingClient.id);
        
        if (clientProposal) {
          // Open existing proposal details
          setSelectedProposal(clientProposal);
          setIsProposalDetailsModalOpen(true);
          updateStatus.mutate({ leadId, status: newStatus });
        } else {
          // Client exists but no proposal - go directly to create proposal
          setPendingLead(lead || null);
          setNewlyCreatedClientId(existingClient.id);
          setIsCreateProposalModalOpen(true);
        }
        return;
      }
      
      // No client exists - open create client modal first
      setPendingLead(lead || null);
      setIsCreateClientModalOpen(true);
      return;
    }
    
    // Intercept drops on lost stages -> open lost lead dialog
    if (isLostStage(newStatus)) {
      setPendingLostStatus({ leadId, status: newStatus });
      setPendingLead(lead || null);
      setIsLostDialogOpen(true);
      return;
    }

    // Intercept drops on won stages -> auto-create client + open sale modal
    if (isWonStage(newStatus) && lead) {
      const isPerfect2Gether = isPerfect2GetherOrg(organization?.id);
      setPendingWonData({ leadId, status: newStatus });
      const existingClient = clients.find(c => c.lead_id === leadId || (lead.company_nif && c.company_nif === lead.company_nif));

      if (isPerfect2Gether) {
        // Perfect2Gether custom flow
        if (existingClient) {
          // Already a client → mark won immediately + open proposal modal
          updateStatus.mutate({ leadId, status: newStatus });
          setPendingWonData(null);
          toast.success('Lead ganha! Cliente já existente — criar proposta.');
          setPrefillProposalClientId(existingClient.id);
          setNewlyCreatedClientId(existingClient.id);
          setIsCreateProposalModalOpen(true);
        } else {
          // Not a client → create client → navigate to client page
          convertLeadToClient.mutate({
            lead_id: leadId,
            name: (lead.name && lead.name !== lead.company_name)
              ? lead.name
              : (lead.company_name || lead.name || 'Sem nome'),
            email: lead.email,
            phone: lead.phone,
            company: lead.company_name || undefined,
            company_nif: lead.company_nif || undefined,
            notes: lead.notes || undefined,
          }, {
            onSuccess: (newClient) => {
              updateStatus.mutate({ leadId, status: newStatus });
              setPendingWonData(null);
              toast.success('Lead ganha! Novo cliente criado.');
              if (newClient?.id) {
                navigate('/clients', { state: { openClientId: newClient.id } });
              }
            },
          });
        }
        return;
      }

      // Default flow for all other orgs
      if (existingClient) {
        toast.success('Lead ganha! Cliente já existente.');
        setPrefillSaleClientId(existingClient.id);
        setPrefillSaleClient({
          id: existingClient.id,
          name: existingClient.name,
          code: existingClient.code,
          email: existingClient.email,
          nif: existingClient.nif,
          address_line1: existingClient.address_line1,
          city: existingClient.city,
          postal_code: existingClient.postal_code,
          country: existingClient.country,
        });
        setIsCreateSaleModalOpen(true);
      } else {
        convertLeadToClient.mutate({
          lead_id: leadId,
          name: (lead.name && lead.name !== lead.company_name) 
            ? lead.name 
            : (lead.company_name || lead.name || 'Sem nome'),
          email: lead.email,
          phone: lead.phone,
          company: lead.company_name || undefined,
          company_nif: lead.company_nif || undefined,
          notes: lead.notes || undefined,
        }, {
          onSuccess: (newClient) => {
            toast.success('Lead ganha! Novo cliente criado.');
            if (newClient?.id) {
              setPrefillSaleClientId(newClient.id);
              setPrefillSaleClient({
                id: newClient.id,
                name: newClient.name,
                code: newClient.code,
                email: newClient.email,
                nif: newClient.nif,
                address_line1: newClient.address_line1,
                city: newClient.city,
                postal_code: newClient.postal_code,
                country: newClient.country,
              });
              setIsCreateSaleModalOpen(true);
            }
          },
        });
      }
      return;
    }
    
    // For other statuses, update normally
    updateStatus.mutate({ leadId, status: newStatus });
  };

  const handleEventCreated = () => {
    // Status já é atualizado automaticamente pelo useCreateEvent hook
    // Apenas limpar os estados locais
    setPendingLead(null);
    setSelectedEvent(null);
    setIsCreateEventModalOpen(false);
  };

  const handleLostConfirm = (data: {
    lossReason: string;
    notes: string;
    followUpDate: string;
    followUpTime: string;
    eventType: "call" | "meeting";
    scheduleFollowUp: boolean;
    reminderMinutes: number | null;
  }) => {
    if (!pendingLostStatus || !pendingLead) return;

    const LOSS_REASON_LABELS: Record<string, string> = {
      price: "Preço",
      competition: "Concorrência",
      no_response: "Sem resposta",
      timing: "Timing",
      other: "Outro",
    };

    // Build notes with loss reason
    const reasonLabel = LOSS_REASON_LABELS[data.lossReason] || data.lossReason;
    const lossNote = `[Perdido - ${reasonLabel}]${data.notes ? ` ${data.notes}` : ""}`;
    const existingNotes = pendingLead.notes || "";
    const updatedNotes = existingNotes ? `${existingNotes}\n${lossNote}` : lossNote;

    // Update lead notes always
    updateLead.mutate({ leadId: pendingLostStatus.leadId, updates: { notes: updatedNotes } });

    // Only mark as lost if NO follow-up is scheduled; otherwise move to "Agendado"
    if (!data.followUpDate) {
      updateStatus.mutate({ leadId: pendingLostStatus.leadId, status: pendingLostStatus.status });
    } else {
      const scheduledStage = stages?.find(s => isScheduledStage(s.key));
      if (scheduledStage) {
        updateStatus.mutate({ leadId: pendingLostStatus.leadId, status: scheduledStage.key });
      } else {
        // Fallback: no scheduled stage exists, mark as lost anyway
        updateStatus.mutate({ leadId: pendingLostStatus.leadId, status: pendingLostStatus.status });
      }
    }

    // Create follow-up calendar event only if requested
    if (data.followUpDate && user && organization) {
      const followUpDate = new Date(`${data.followUpDate}T${data.followUpTime}:00`);
      
      supabase
        .from('calendar_events')
        .insert({
          title: `Recontacto: ${pendingLead.name}`,
          description: `Follow-up de lead perdido (${reasonLabel}). ${data.notes || ""}`.trim(),
          event_type: data.eventType,
          start_time: followUpDate.toISOString(),
          lead_id: pendingLead.id,
          user_id: user!.id,
          organization_id: organization!.id,
          reminder_minutes: data.reminderMinutes,
        })
        .select()
        .single()
        .then(({ error }) => {
          if (error) {
            toast.error('Erro ao criar agendamento de recontacto');
            console.error('Error creating follow-up event:', error);
          } else {
            toast.success('Recontacto agendado com sucesso');
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
            queryClient.invalidateQueries({ queryKey: ['lead-events'] });
          }
        });
    }
    setIsLostDialogOpen(false);
    setPendingLostStatus(null);
    setPendingLead(null);
  };

  const handleEditEvent = () => {
    // Close details modal and open create/edit modal
    setIsEventDetailsModalOpen(false);
    setIsCreateEventModalOpen(true);
  };

  const handleProposalCreated = () => {
    if (pendingLead && !prefillProposalClientId) {
      // Normal proposal stage flow (not Perfect2Gether won flow)
      const proposalStage = stages.find(s => isProposalStage(s.key));
      if (proposalStage) {
        updateStatus.mutate({ leadId: pendingLead.id, status: proposalStage.key });
      }
    }
    setPendingLead(null);
    setNewlyCreatedClientId(null);
    setPrefillProposalClientId(null);
    setIsChainedFlow(false);
    setIsCreateProposalModalOpen(false);
  };

  // Handler for when client is created in the chained flow (Lead -> Client -> Proposal)
  const handleClientCreatedForProposal = (clientId: string) => {
    // Mark that we're in a chained flow (preserve pendingLead)
    setIsChainedFlow(true);
    // Close client modal
    setIsCreateClientModalOpen(false);
    // Store the new client ID
    setNewlyCreatedClientId(clientId);
    // Open proposal modal
    setIsCreateProposalModalOpen(true);
  };

  const handleTemperatureChange = (leadId: string, temperature: LeadTemperature) => {
    updateLead.mutate({ leadId, updates: { temperature } });
  };

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const handleDelete = (leadId: string) => {
    deleteLead.mutate(leadId);
  };

  const handleUpdate = (leadId: string, updates: Partial<Lead>) => {
    updateLead.mutate({ leadId, updates });
  };

  const handleAssignSuccess = () => {
    setSelectedIds([]);
    setShowAssignModal(false);
  };

  // Export handlers
  const handleExportCsv = () => {
    const selectedLeads = filteredLeads.filter(l => selectedIds.includes(l.id));
    const data = mapLeadsForExport(selectedLeads);
    exportToCsv(data, `leads_${format(new Date(), 'yyyy-MM-dd')}`);
    toast.success(`${selectedLeads.length} leads exportados para CSV`);
  };

  const handleExportExcel = () => {
    const selectedLeads = filteredLeads.filter(l => selectedIds.includes(l.id));
    const data = mapLeadsForExport(selectedLeads);
    exportToExcel(data, `leads_${format(new Date(), 'yyyy-MM-dd')}`);
    toast.success(`${selectedLeads.length} leads exportados para Excel`);
  };

  // Helper to get badge style from stage color
  const getBadgeStyle = (hexColor: string, isActive: boolean) => {
    if (isActive) {
      return {
        backgroundColor: hexColor,
        color: '#fff',
        borderColor: hexColor,
      };
    }
    return {
      backgroundColor: 'transparent',
      color: hexColor,
      borderColor: `${hexColor}50`,
    };
  };

  return (
    <div className="p-4 lg:p-8">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pipeline' | 'report')} className="space-y-4">
        <div className="mb-4 lg:mb-6 space-y-3 lg:space-y-4">
          {/* Linha 1: Título + Pesquisa */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl lg:text-2xl font-bold text-foreground">Leads</h1>
                <Badge variant="secondary" className="text-xs font-medium">
                  {hasActiveFilters ? `${filteredLeads.length} / ${leads.length}` : leads.length}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground hidden sm:block">Gerencie os contactos da sua organização.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <TabsList className="h-9">
                <TabsTrigger value="pipeline" className="text-xs gap-1">
                  <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
                </TabsTrigger>
                <TabsTrigger value="report" className="text-xs gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Relatório
                </TabsTrigger>
              </TabsList>

              {activeTab === 'pipeline' && (
                <>
                  {/* View Mode Toggle */}
                  <div className="hidden sm:flex items-center border border-border rounded-lg p-1 bg-background">
                    <Button 
                      variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} 
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewMode('kanban')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewMode('table')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Button onClick={() => setIsAddModalOpen(true)} className="shrink-0 h-9 lg:h-10">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {activeTab === 'pipeline' && (
            <div className="flex flex-col gap-3 pb-1">
              <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-3">
                <div className="relative w-full min-w-0 md:flex-1 md:min-w-[260px] lg:min-w-[320px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Pesquisar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
                </div>

                {/* Team Member Filter (Admin Only) */}
                <TeamMemberFilter className="w-full md:w-[260px] lg:w-[280px] shrink-0" />

                {/* Date Range Picker */}
                <DateRangePicker
                  value={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onChange={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  placeholder="Período"
                  className="h-9 w-full md:w-[240px] lg:w-[260px] shrink-0 justify-start"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Mobile View Mode Toggle */}
                <div className="flex sm:hidden items-center border border-border rounded-lg p-1 bg-background shrink-0">
                  <Button 
                    variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} 
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setViewMode('kanban')}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Mobile: Select dropdown for status filter */}
                <Select
                  value={statusFilter.length === 1 ? statusFilter[0] : "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setStatusFilter([]);
                    } else {
                      setStatusFilter([value]);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-full md:hidden sm:w-[180px] shrink-0">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.key}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Tipologia Filter (Telecom only) */}
                {showEnergy && (
                  <Select value={tipologiaFilter} onValueChange={(v) => setTipologiaFilter(v as 'all' | LeadTipologia)}>
                    <SelectTrigger className="w-[140px] h-8 shrink-0">
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      <SelectValue placeholder="Tipologia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {(Object.entries(TIPOLOGIA_LABELS) as [LeadTipologia, string][]).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-muted-foreground hover:text-foreground shrink-0">
                    <X className="mr-1 h-3.5 w-3.5" />
                    <span className="text-xs">Limpar</span>
                  </Button>
                )}
              </div>

              {/* Desktop: Status Filter Badges */}
              <div className="hidden md:flex flex-wrap items-center gap-2">
                {stages.map((stage) => (
                  <Badge
                    key={stage.id}
                    variant="outline"
                    className="cursor-pointer transition-colors hover:opacity-80 text-xs"
                    style={getBadgeStyle(stage.color, statusFilter.includes(stage.key))}
                    onClick={() => toggleStatus(stage.key)}
                  >
                    {stage.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <TabsContent value="pipeline" className="mt-0">
        {/* Bulk Actions Bar */}
        {viewMode === 'table' && (
          <BulkActionsBar
            selectedCount={selectedIds.length}
            onAssignTeamMember={() => setShowAssignModal(true)}
            onExportCsv={handleExportCsv}
            onExportExcel={handleExportExcel}
            onClearSelection={() => setSelectedIds([])}
            entityLabel="leads selecionados"
          />
        )}

        <div className="rounded-xl border bg-card p-3 lg:p-4">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredLeads.length === 0 && searchQuery ? (
            <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum resultado encontrado</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Sem leads por agora</p>
            </div>
          ) : viewMode === 'kanban' ? (
            <ResponsiveKanban leads={filteredLeads} onStatusChange={handleStatusChange} onTemperatureChange={handleTemperatureChange} onViewDetails={handleViewDetails} onDelete={handleDelete} />
          ) : (
            <LeadsTableView 
              leads={filteredLeads} 
              onStatusChange={handleStatusChange} 
              onTemperatureChange={handleTemperatureChange} 
              onViewDetails={handleViewDetails} 
              onDelete={handleDelete}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
        </div>
        </TabsContent>

        <TabsContent value="report" className="mt-0">
          <LeadsReportPanel />
        </TabsContent>

        <LeadDetailsModal lead={selectedLead} open={isModalOpen} onOpenChange={setIsModalOpen} onStatusChange={handleStatusChange} onDelete={handleDelete} onUpdate={handleUpdate} />
        <AddLeadModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
        
        <EventDetailsModal
          open={isEventDetailsModalOpen}
          onOpenChange={(open) => {
            setIsEventDetailsModalOpen(open);
            if (!open) setSelectedEvent(null);
          }}
          event={selectedEvent}
          onEdit={handleEditEvent}
        />
        
        <CreateEventModal
          open={isCreateEventModalOpen}
          onOpenChange={(open) => {
            setIsCreateEventModalOpen(open);
            if (!open) {
              setPendingLead(null);
              setSelectedEvent(null);
            }
          }}
          selectedDate={new Date()}
          preselectedLeadId={pendingLead?.id || selectedEvent?.lead_id}
          event={selectedEvent}
          onSuccess={handleEventCreated}
        />
        
        <CreateClientModal
          open={isCreateClientModalOpen}
          onOpenChange={(open) => {
            setIsCreateClientModalOpen(open);
            if (!open && !isChainedFlow) {
              setPendingLead(null);
            }
          }}
          onCreated={handleClientCreatedForProposal}
          initialData={pendingLead ? {
            name: pendingLead.name,
            email: pendingLead.email,
            phone: pendingLead.phone,
            notes: pendingLead.notes || undefined,
            source: "lead",
            leadId: pendingLead.id,
          } : undefined}
        />
        
        <CreateProposalModal
          open={isCreateProposalModalOpen}
          onOpenChange={(open) => {
            setIsCreateProposalModalOpen(open);
            if (!open) {
              setPendingLead(null);
              setNewlyCreatedClientId(null);
              setIsChainedFlow(false);
            }
          }}
          onSuccess={handleProposalCreated}
          preselectedClientId={newlyCreatedClientId}
          leadId={pendingLead?.id}
        />
        
        <ProposalDetailsModal
          proposal={selectedProposal}
          open={isProposalDetailsModalOpen && !!selectedProposal}
          onOpenChange={(open) => {
            setIsProposalDetailsModalOpen(open);
            if (!open) setSelectedProposal(null);
          }}
        />

        <AssignTeamMemberModal
          open={showAssignModal}
          onOpenChange={setShowAssignModal}
          selectedIds={selectedIds}
          entityType="leads"
          onSuccess={handleAssignSuccess}
        />

        <LostLeadDialog
          open={isLostDialogOpen}
          onOpenChange={(open) => {
            setIsLostDialogOpen(open);
            if (!open) {
              setPendingLostStatus(null);
              setPendingLead(null);
            }
          }}
          leadName={pendingLead?.name || ""}
          isTelecom={isTelecom}
          onConfirm={handleLostConfirm}
        />

        <CreateSaleModal
          open={isCreateSaleModalOpen}
          onOpenChange={(open) => {
            setIsCreateSaleModalOpen(open);
            if (!open) {
              setPrefillSaleClientId(null);
              setPrefillSaleClient(null);
              setPendingWonData(null);
            }
          }}
          prefillClientId={prefillSaleClientId}
          prefillClient={prefillSaleClient}
          onSaleCreated={() => {
            if (pendingWonData) {
              updateStatus.mutate({ leadId: pendingWonData.leadId, status: pendingWonData.status });
              setPendingWonData(null);
            }
          }}
        />
      </Tabs>
    </div>
  );
}
