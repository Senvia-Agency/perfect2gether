import { useEffect, useState, type ReactNode } from "react";
import { useModules } from "@/hooks/useModules";
import { isPerfect2GetherOrg } from "@/lib/perfect2gether";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Phone,
  Building2,
  MapPin,
  FileText,
  ShoppingCart,
  Edit,
  MessageSquare,
  Plus,
  Calendar as CalendarIcon,
  Save,
  X,
  User,
  ChevronRight,
  Files,
  Users,
  MoreHorizontal,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { parseDecisionMakers } from "@/lib/decision-makers";
import { formatDate, formatCurrency, getWhatsAppUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS, type ProposalStatus, type Proposal } from "@/types/proposals";
import { SALE_STATUS_LABELS, SALE_STATUS_COLORS, type SaleStatus } from "@/types/sales";
import { ProposalDetailsModal } from "@/components/proposals/ProposalDetailsModal";
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
import { useClientLabels } from "@/hooks/useClientLabels";
import { useClientHistory } from "@/hooks/useClientHistory";
import { useClientCertificateHistory, useClientPeopleRoles } from "@/hooks/useClientEdpData";
import { useUpdateClient } from "@/hooks/useClients";
import { useDeleteCommunication } from "@/hooks/useClientCommunications";
import { usePermissions } from "@/hooks/usePermissions";
import { useTeamMembers } from "@/hooks/useTeam";
import { useCpes } from "@/hooks/useCpes";
import { useAuth } from "@/contexts/AuthContext";
import { ClientTimeline } from "./ClientTimeline";
import { AddCommunicationModal } from "./AddCommunicationModal";
import { CpeList } from "./CpeList";
import { ClientDocumentsCard } from "./ClientDocumentsCard";
import { ClientPeopleCard } from "./ClientPeopleCard";
import { ClientSourceMetadataCard } from "./ClientSourceMetadataCard";
import { RenewClientCertificateModal } from "./RenewClientCertificateModal";
import type { CrmClient } from "@/types/clients";
import type { CommunicationType, CommunicationDirection } from "@/types/communications";
import { certificateValidity, parseClientSourceMetadata, type ClientCertificateHistoryRow } from "@/lib/client-certificate";

interface ClientDetailsDrawerProps {
  client: CrmClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: CrmClient) => void;
  onNewProposal?: (client: CrmClient) => void;
  onNewSale?: (client: CrmClient) => void;
  onScheduleMeeting?: (client: CrmClient) => void;
}

type DetailsTab = 'resumo' | 'cpes' | 'negocio' | 'documentos' | 'historico';

const RECENT_ACTIVITY_LIMIT = 3;

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-3 py-2">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn("truncate text-lg font-semibold", className)}>{value}</p>
    </div>
  );
}

export function ClientDetailsDrawer({
  client,
  open,
  onOpenChange,
  onEdit,
  onNewProposal,
  onNewSale,
  onScheduleMeeting
}: ClientDetailsDrawerProps) {
  const labels = useClientLabels();
  const { timeline, proposals, sales, isLoading: loadingHistory } = useClientHistory(client?.id || null);
  const updateClient = useUpdateClient();
  const deleteCommunication = useDeleteCommunication();
  const { can, isEdpWorkflowActor } = usePermissions();
  const canEditClient = can('clients', 'list', 'edit');
  // Carregar e arquivar documentos segue a regra do servidor (admin, Back Office, comerciais), não a edição da ficha.
  const canManageDocuments = isEdpWorkflowActor;
  const canAddComm = can('clients', 'communications', 'add');
  const canDeleteComm = can('clients', 'communications', 'delete');
  const [commToDelete, setCommToDelete] = useState<string | null>(null);
  const { data: teamMembers = [] } = useTeamMembers();
  const { organization } = useAuth();

  const isTelecom = organization?.niche === 'telecom';
  const isP2G = isPerfect2GetherOrg(organization?.id);
  const { modules } = useModules();
  const showEnergy = isTelecom && modules.energy;
  const { data: cpes = [] } = useCpes(isTelecom ? client?.id : null);
  const clientPeople = useClientPeopleRoles(isP2G && open ? client?.id ?? null : null);
  const certificateHistory = useClientCertificateHistory(isP2G && open ? client?.id ?? null : null);

  const [tab, setTab] = useState<DetailsTab>('resumo');
  const [showAddCommunication, setShowAddCommunication] = useState(false);
  const [defaultCommType, setDefaultCommType] = useState<CommunicationType>('note');
  const [defaultCommDirection, setDefaultCommDirection] = useState<CommunicationDirection>('outbound');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [renewCertificateVersion, setRenewCertificateVersion] = useState<ClientCertificateHistoryRow | null>(null);
  const [showCertificateRenewal, setShowCertificateRenewal] = useState(false);
  const [documentUploadRequest, setDocumentUploadRequest] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTab('resumo');
    setDocumentUploadRequest(0);
  }, [client?.id, open]);

  const getTeamMemberName = (userId: string | null | undefined) => {
    if (!userId) return null;
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.full_name || null;
  };

  const handleOpenCommunicationModal = (type: CommunicationType = 'note', direction: CommunicationDirection = 'outbound') => {
    setDefaultCommType(type);
    setDefaultCommDirection(direction);
    setShowAddCommunication(true);
  };

  const handleTabChange = (value: string) => {
    // O pedido de upload só deve abrir o formulário uma vez, não sempre que o separador volta a montar.
    // Mudar de separador à mão nunca é um pedido de upload (esse vem de handleAddDocument).
    setDocumentUploadRequest(0);
    setTab(value as DetailsTab);
  };

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");

  useEffect(() => {
    if (client && !isEditingNotes) {
      setEditedNotes(client.notes || "");
    }
  }, [client, isEditingNotes]);

  if (!client) return null;

  const handleSaveNotes = () => {
    if (editedNotes !== (client.notes || "")) {
      updateClient.mutate({ id: client.id, notes: editedNotes || null });
    }
    setIsEditingNotes(false);
  };

  const handleCancelNotes = () => {
    setEditedNotes(client.notes || "");
    setIsEditingNotes(false);
  };

  const handleAddDocument = () => {
    setTab('documentos');
    setDocumentUploadRequest((current) => current + 1);
  };

  const statusStyle = {
    active: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
    inactive: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted' },
    vip: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  }[client.status] || { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted' };

  const statusLabel = {
    active: labels.statusActive,
    inactive: labels.statusInactive,
    vip: labels.statusVip,
  }[client.status] || client.status;

  const sourceLabel = {
    lead: 'Lead Convertido',
    referral: 'Indicação',
    direct: 'Contacto Direto',
    website: 'Website',
    other: 'Outro',
  }[client.source || ''] || client.source;

  const decisionMakers = parseDecisionMakers(client.decision_makers, client.decision_maker_name);
  const peopleRows = clientPeople.data ?? [];
  const sourceMetadata = isP2G ? parseClientSourceMetadata(client.source_metadata) : null;
  const currentCertificate = certificateHistory.data?.find(version => version.is_current) ?? null;
  const certificateExpired = !!currentCertificate && certificateValidity(currentCertificate.valid_until) === 'expired';
  const incompleteContacts = peopleRows.some(row => row.role === 'decision_maker' && !row.is_complete);

  const title = client.company || client.name;
  const contactName = client.company && client.company !== client.name ? client.name : null;
  const taxId = client.company_nif || client.nif;
  const location = [client.conselho, client.distrito].filter(Boolean).join(', ');
  const assignedName = getTeamMemberName(client.assigned_to);
  const addressLines = [
    client.address_line1,
    client.address_line2,
    [client.postal_code, client.city].filter(Boolean).join(' '),
    client.country,
  ].filter(Boolean);
  const billingLabel = client.billing_target === 'company' ? 'Empresa' : labels.singular;
  const peopleCount = new Set(peopleRows.map(row => row.person_id)).size || decisionMakers.length;
  const recentActivity = timeline.slice(0, RECENT_ACTIVITY_LIMIT);

  const editButton = canEditClient ? (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar ficha" onClick={() => onEdit(client)}>
      <Pencil className="h-4 w-4" />
    </Button>
  ) : null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="fullScreen" className="flex flex-col p-0 gap-0">
        <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col">
          {/* Cabeçalho fixo: identificação, alertas, métricas e ações */}
          <DialogHeader className="shrink-0 space-y-0 border-b px-4 pb-0 pt-8 pr-12 text-left sm:px-8 sm:pt-12 sm:pr-16">
            <div className="mx-auto w-full max-w-6xl space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="flex flex-wrap items-baseline gap-x-2 text-xl">
                    <span className="break-words">{title}</span>
                    {client.code && <span className="font-mono text-sm font-normal text-muted-foreground">#{client.code}</span>}
                  </DialogTitle>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {contactName && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{contactName}</span>}
                    {taxId && <span>NIF {taxId}</span>}
                    {location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location}</span>}
                    <span>Comercial: {assignedName ?? 'sem responsável'}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="outline" className={cn('text-xs', statusStyle.bg, statusStyle.text, statusStyle.border)}>
                      {statusLabel}
                    </Badge>
                    {sourceLabel && <Badge variant="secondary" className="text-xs">{sourceLabel}</Badge>}
                    {certificateExpired && (
                      <Badge variant="destructive" className="gap-1 text-xs"><AlertTriangle className="h-3 w-3" />Certidão expirada</Badge>
                    )}
                    {sourceMetadata?.cae_review && (
                      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15 text-xs text-amber-800 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />CAE por rever</Badge>
                    )}
                    {incompleteContacts && (
                      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15 text-xs text-amber-800 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />Contacto incompleto</Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {client.phone && (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${client.phone}`}><Phone className="mr-1 h-4 w-4" />Ligar</a>
                      </Button>
                      <Button variant="outline" size="sm" className="border-success/20 text-success hover:bg-success/10" asChild>
                        <a href={getWhatsAppUrl(client.phone)} target="_blank" rel="noopener noreferrer"><MessageSquare className="mr-1 h-4 w-4" />WhatsApp</a>
                      </Button>
                    </>
                  )}
                  {client.email && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`mailto:${client.email}`}><Mail className="mr-1 h-4 w-4" />Email</a>
                    </Button>
                  )}
                  {onNewProposal && (
                    <Button size="sm" onClick={() => onNewProposal(client)}>
                      <FileText className="mr-1 h-4 w-4" />Nova proposta
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" aria-label="Mais ações">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEditClient && (
                        <DropdownMenuItem onSelect={() => onEdit(client)}>
                          <Edit className="mr-2 h-4 w-4" />Editar ficha
                        </DropdownMenuItem>
                      )}
                      {canAddComm && (
                        <DropdownMenuItem onSelect={() => handleOpenCommunicationModal('note', 'outbound')}>
                          <Plus className="mr-2 h-4 w-4" />Registar contacto
                        </DropdownMenuItem>
                      )}
                      {isP2G && canManageDocuments && (
                        <DropdownMenuItem onSelect={handleAddDocument}>
                          <Files className="mr-2 h-4 w-4" />Adicionar documento
                        </DropdownMenuItem>
                      )}
                      {(onNewSale || onScheduleMeeting) && <DropdownMenuSeparator />}
                      {onNewSale && (
                        <DropdownMenuItem onSelect={() => onNewSale(client)}>
                          <ShoppingCart className="mr-2 h-4 w-4" />Nova venda
                        </DropdownMenuItem>
                      )}
                      {onScheduleMeeting && (
                        <DropdownMenuItem onSelect={() => onScheduleMeeting(client)}>
                          <CalendarIcon className="mr-2 h-4 w-4" />Agendar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Propostas" value={client.total_proposals} className="text-primary" />
                <Metric label="Vendas" value={client.total_sales} className="text-success" />
                {showEnergy && <Metric label="MWh/ano" value={(client.total_mwh || 0).toFixed(2)} />}
                {isTelecom && <Metric label="Comissão" value={formatCurrency(client.total_comissao || 0)} />}
                {showEnergy && !isP2G && <Metric label="kWp" value={(client.total_kwp || 0).toFixed(2)} />}
                {!isTelecom && <Metric label="Valor total" value={formatCurrency(client.total_value)} />}
              </div>

              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
                {[
                  { value: 'resumo', label: 'Resumo', show: true },
                  { value: 'cpes', label: `CPE/CUI (${cpes.length})`, show: showEnergy },
                  { value: 'negocio', label: `Negócio (${proposals.length + sales.length})`, show: true },
                  { value: 'documentos', label: 'Documentos', show: isP2G },
                  { value: 'historico', label: 'Histórico', show: true },
                ].filter(item => item.show).map(item => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <DialogDescription className="sr-only">Ficha do cliente {client.name}</DialogDescription>
          </DialogHeader>

          {/* Corpo com scroll próprio */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl p-4 sm:p-6">
              <TabsContent value="resumo" className="mt-0">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-4 w-4" />Empresa e contactos
                      </CardTitle>
                      {editButton}
                    </CardHeader>
                    <CardContent>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                        <Field label="Nome">{client.name}</Field>
                        {client.company && <Field label="Empresa">{client.company}</Field>}
                        {client.nif && <Field label="NIF">{client.nif}</Field>}
                        {client.company_nif && <Field label="NIF da empresa">{client.company_nif}</Field>}
                        <Field label="Email">
                          {client.email ? <a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a> : '—'}
                        </Field>
                        <Field label="Telefone">{client.phone || '—'}</Field>
                        {client.grupo_economico && <Field label="Grupo económico">{client.grupo_economico}</Field>}
                        <Field label="Faturação">{billingLabel}</Field>
                        <Field label="Morada" wide>
                          {addressLines.length > 0 ? addressLines.map((line, index) => <span key={index} className="block">{line}</span>) : '—'}
                        </Field>
                      </dl>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4" />Pessoas
                        {peopleCount > 0 && <Badge variant="secondary" className="text-xs">{peopleCount}</Badge>}
                      </CardTitle>
                      {editButton}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {isP2G && peopleRows.length > 0 ? (
                        <ClientPeopleCard rows={peopleRows} embedded />
                      ) : decisionMakers.length > 0 ? (
                        decisionMakers.map((person, index) => (
                          <div key={index} className="space-y-1 rounded-lg border p-3 text-sm">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium">{person.name}</span>
                              {person.role && <span className="text-xs text-muted-foreground">{person.role}</span>}
                            </div>
                            {person.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <a href={`tel:${person.phone}`} className="hover:underline">{person.phone}</a>
                                <a href={getWhatsAppUrl(person.phone)} target="_blank" rel="noopener noreferrer" className="text-xs text-success hover:underline">
                                  WhatsApp
                                </a>
                              </div>
                            )}
                            {person.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <a href={`mailto:${person.email}`} className="break-all text-primary hover:underline">{person.email}</a>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Sem pessoas associadas.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-base">Notas</CardTitle>
                      {canEditClient && (!isEditingNotes ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar notas" onClick={() => setIsEditingNotes(true)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={handleCancelNotes}>
                            <X className="mr-1 h-4 w-4" />
                            Cancelar
                          </Button>
                          <Button variant="default" size="sm" onClick={handleSaveNotes} disabled={updateClient.isPending}>
                            <Save className="mr-1 h-4 w-4" />
                            Guardar
                          </Button>
                        </div>
                      ))}
                    </CardHeader>
                    <CardContent>
                      {isEditingNotes ? (
                        <Textarea
                          value={editedNotes}
                          onChange={(e) => setEditedNotes(e.target.value)}
                          placeholder="Adicionar notas sobre este cliente..."
                          className="min-h-[120px]"
                        />
                      ) : (
                        <div
                          className={cn(
                            "min-h-[64px] whitespace-pre-wrap rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground",
                            canEditClient && "cursor-pointer transition-colors hover:bg-muted/50"
                          )}
                          onClick={canEditClient ? () => setIsEditingNotes(true) : undefined}
                        >
                          {client.notes || (canEditClient ? "Clique para adicionar notas..." : "Sem notas")}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-base">Atividade recente</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setTab('historico')}>
                        Ver tudo<ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <ClientTimeline events={recentActivity} isLoading={loadingHistory} />
                    </CardContent>
                  </Card>

                  {isP2G && (
                    <div className="lg:col-span-2">
                      <ClientSourceMetadataCard value={client.source_metadata} />
                    </div>
                  )}
                </div>
              </TabsContent>

              {showEnergy && (
                <TabsContent value="cpes" className="mt-0">
                  <Card>
                    <CardContent className="pt-6">
                      <CpeList clientId={client.id} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              <TabsContent value="negocio" className="mt-0">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-base">Propostas ({proposals.length})</CardTitle>
                      {onNewProposal && (
                        <Button variant="outline" size="sm" onClick={() => onNewProposal(client)}>
                          <Plus className="mr-1 h-4 w-4" />Nova
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {proposals.length === 0 && <p className="text-sm text-muted-foreground">Sem propostas.</p>}
                      {proposals.map((proposal) => (
                        <button
                          type="button"
                          key={proposal.id}
                          className="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm transition-colors hover:bg-muted/50"
                          onClick={() => setSelectedProposal(proposal as unknown as Proposal)}
                        >
                          <div>
                            <p className="font-medium">{proposal.code || `#${proposal.id.slice(0, 8)}`}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(proposal.created_at || '')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="font-semibold text-success">{formatCurrency(proposal.total_value)}</p>
                              <Badge variant="outline" className={cn('text-xs', PROPOSAL_STATUS_COLORS[proposal.status as ProposalStatus])}>
                                {PROPOSAL_STATUS_LABELS[proposal.status as ProposalStatus] || proposal.status}
                              </Badge>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-base">Vendas ({sales.length})</CardTitle>
                      {onNewSale && (
                        <Button variant="outline" size="sm" onClick={() => onNewSale(client)}>
                          <Plus className="mr-1 h-4 w-4" />Nova
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {sales.length === 0 && <p className="text-sm text-muted-foreground">Sem vendas.</p>}
                      {sales.map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                          <div>
                            <p className="font-medium">{sale.code || `#${sale.id.slice(0, 8)}`}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(sale.created_at || '')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-success">{formatCurrency(sale.total_value)}</p>
                            <Badge variant="outline" className={cn('text-xs', SALE_STATUS_COLORS[sale.status as SaleStatus])}>
                              {SALE_STATUS_LABELS[sale.status as SaleStatus] || sale.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {isP2G && (
                <TabsContent value="documentos" className="mt-0">
                  <ClientDocumentsCard
                    clientId={client.id}
                    canManage={canManageDocuments}
                    openUploadRequest={documentUploadRequest}
                    onRenewCertificate={canEditClient ? currentVersion => {
                      setRenewCertificateVersion(currentVersion);
                      setShowCertificateRenewal(true);
                    } : undefined}
                  />
                </TabsContent>
              )}

              <TabsContent value="historico" className="mt-0">
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base">Histórico</CardTitle>
                    {canAddComm && (
                      <Button variant="outline" size="sm" onClick={() => handleOpenCommunicationModal('note', 'outbound')}>
                        <Plus className="mr-1 h-4 w-4" />
                        Registar contacto
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ClientTimeline
                      events={timeline}
                      isLoading={loadingHistory}
                      onDeleteCommunication={canDeleteComm ? setCommToDelete : undefined}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        {/* Add Communication Modal */}
        <AddCommunicationModal
          open={showAddCommunication}
          onOpenChange={setShowAddCommunication}
          clientId={client.id}
          clientName={client.name}
          defaultType={defaultCommType}
          defaultDirection={defaultCommDirection}
        />

        {/* Remover da ficha — confirmação */}
        <AlertDialog open={!!commToDelete} onOpenChange={(open) => { if (!open) setCommToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover da ficha?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta entrada do histórico será removida permanentemente. Esta ação não pode ser revertida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (commToDelete) {
                    deleteCommunication.mutate({ id: commToDelete, clientId: client.id });
                    setCommToDelete(null);
                  }
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </DialogContent>
    </Dialog>

    {/* Proposal Details Modal - fora do Dialog principal para evitar nested dialogs */}
    <ProposalDetailsModal
      proposal={selectedProposal}
      open={!!selectedProposal}
      onOpenChange={(open) => { if (!open) setSelectedProposal(null); }}
    />
    <RenewClientCertificateModal
      target={{ id: client.id, name: client.name }}
      currentVersion={renewCertificateVersion}
      open={showCertificateRenewal}
      onOpenChange={setShowCertificateRenewal}
    />
  </>
  );
}
