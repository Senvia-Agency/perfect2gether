import {
  Archive,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Files,
  History,
  House,
  IdCard,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  RefreshCw,
  Upload,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type DragEvent } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useArchiveClientDocument, useClientDocuments } from '@/hooks/useClientDocuments';
import { useClientCertificateHistory } from '@/hooks/useClientEdpData';
import type { ClientCertificateHistoryRow } from '@/lib/client-certificate';
import {
  clientDocumentDateStatus,
  clientDocumentSideLabel,
  clientDocumentValidity,
  lisbonToday,
  REQUIRED_CLIENT_DOCUMENT_CATEGORIES,
  summarizeClientDocumentRequirement,
  type ClientDocumentArchiveItem,
  type ClientDocumentDateStatus,
  type ClientDocumentRequirement,
  type ClientDocumentRequirementStatus,
  type RequiredClientDocumentCategory,
} from '@/lib/client-documents';
import type { EdpDocumentVersion } from '@/lib/edp/validation';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getEdpSignedUrl } from '@/modules/edp/api';
import { ClientDocumentUploadDialog, type ClientDocumentUploadPreset } from './ClientDocumentUploadForm';

type ClientDocumentsCardProps = {
  readonly clientId: string;
  readonly canManage: boolean;
  readonly openUploadRequest?: number;
  readonly onRenewCertificate?: (currentVersion: ClientCertificateHistoryRow | null) => void;
};

type VersionAction = 'view' | 'download';
type PendingAction = { readonly versionId: string; readonly action: VersionAction };
type OpenVersion = (version: EdpDocumentVersion, action: VersionAction) => Promise<void>;

const REQUIREMENT_META = {
  CC: { label: 'Cartão de cidadão', icon: IdCard },
  'Comprovativo de morada': { label: 'Comprovativo de morada', icon: House },
  CRC: { label: 'Certidão permanente', icon: Building2 },
  Fatura: { label: 'Fatura de energia', icon: Receipt },
} as const satisfies Record<RequiredClientDocumentCategory, { readonly label: string; readonly icon: LucideIcon }>;

const STATUS_STYLES = {
  missing: { icon: XCircle, text: 'text-destructive', tile: 'border-dashed bg-muted/20' },
  partial: { icon: Clock, text: 'text-amber-800 dark:text-amber-300', tile: 'border-amber-300 dark:border-amber-500/40' },
  expiring: { icon: Clock, text: 'text-amber-800 dark:text-amber-300', tile: 'border-amber-300 dark:border-amber-500/40' },
  expired: { icon: XCircle, text: 'text-destructive', tile: 'border-destructive/40' },
  valid: { icon: CheckCircle2, text: 'text-success', tile: '' },
  unknown: { icon: CheckCircle2, text: 'text-muted-foreground', tile: '' },
} as const satisfies Record<ClientDocumentRequirementStatus, { readonly icon: LucideIcon; readonly text: string; readonly tile: string }>;

function statusText(status: ClientDocumentRequirementStatus, validUntil: string | null, missingSide: 'front' | 'back' | null): string {
  if (status === 'missing') return 'Em falta';
  if (status === 'partial') return missingSide === 'back' ? 'Falta o verso' : 'Falta a frente';
  if (status === 'unknown' || !validUntil) return 'Sem validade indicada';
  if (status === 'expired') return `Expirou a ${formatDate(validUntil)}`;
  if (status === 'expiring') return `Expira a ${formatDate(validUntil)}`;
  return `Válido até ${formatDate(validUntil)}`;
}

export function ClientDocumentsCard({ clientId, canManage, openUploadRequest = 0, onRenewCertificate }: ClientDocumentsCardProps) {
  const archive = useClientDocuments(clientId);
  const certificateHistory = useClientCertificateHistory(clientId);
  const archiveDocument = useArchiveClientDocument(clientId);
  const [uploadPreset, setUploadPreset] = useState<ClientDocumentUploadPreset | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientDocumentArchiveItem | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const documents = useMemo(() => archive.data?.documents ?? [], [archive.data]);
  const people = archive.data?.people ?? [];
  const certificates = certificateHistory.data ?? [];
  const currentCertificate = certificates.find((version) => version.is_current) ?? null;
  const activeDocuments = documents.filter((item) => !item.archivedAt);
  const archivedCount = documents.length - activeDocuments.length;
  const visibleDocuments = showArchived ? documents : activeDocuments;

  const requirements = useMemo(() => {
    const today = lisbonToday();
    return REQUIRED_CLIENT_DOCUMENT_CATEGORIES.map((category) => summarizeClientDocumentRequirement(category, documents, today));
  }, [documents]);

  useEffect(() => {
    if (canManage && openUploadRequest > 0) setUploadPreset({});
  }, [canManage, openUploadRequest]);

  const openUpload = (preset: ClientDocumentUploadPreset) => {
    setMessage(null);
    setUploadPreset(preset);
  };

  const openVersion: OpenVersion = async (version, action) => {
    setPendingAction({ versionId: version.version_id, action });
    setMessage(null);
    try {
      const signed = await getEdpSignedUrl(version.version_id);
      const link = document.createElement('a');
      if (action === 'download') {
        // O atributo download é ignorado noutro domínio (Storage): descarregar via blob guarda com o nome original.
        const response = await fetch(signed.url);
        if (!response.ok) throw new Error('Não foi possível descarregar o ficheiro.');
        const objectUrl = URL.createObjectURL(await response.blob());
        link.href = objectUrl;
        link.download = version.original_name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      } else {
        link.href = signed.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
    } catch (error) {
      if (error instanceof Error) setMessage(error.message);
      else throw error;
    } finally {
      setPendingAction(null);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setMessage(null);
    try {
      await archiveDocument.mutateAsync(archiveTarget.documentId);
      setMessage('Documento arquivado. O histórico foi preservado.');
      setArchiveTarget(null);
    } catch (error) {
      if (error instanceof Error) setMessage(error.message);
      else throw error;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Files className="h-4 w-4" aria-hidden="true" />
              Documentos
            </CardTitle>
            {canManage && (
              <Button type="button" size="sm" onClick={() => openUpload({})}>
                <Plus aria-hidden="true" />Adicionar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section aria-label="Documentos necessários" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* Sem a lista carregada não se sabe o que falta: mostrar "Em falta" levaria a carregar duplicados. */}
            {!archive.data && REQUIRED_CLIENT_DOCUMENT_CATEGORIES.map((category) => (
              <div key={category} className="h-28 animate-pulse rounded-lg border bg-muted/30" aria-hidden="true" />
            ))}
            {archive.data && requirements.map((requirement) => (
              <RequirementTile
                key={requirement.category}
                requirement={requirement}
                certificate={requirement.category === 'CRC' ? currentCertificate : null}
                certificates={requirement.category === 'CRC' ? certificates : []}
                canManage={canManage}
                pendingAction={pendingAction}
                onOpenVersion={openVersion}
                onUpload={openUpload}
                onRenewCertificate={onRenewCertificate}
              />
            ))}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                Todos os documentos
                <Badge variant="secondary" className="text-xs">{activeDocuments.length}</Badge>
              </h3>
              {archivedCount > 0 && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" aria-pressed={showArchived} onClick={() => setShowArchived((current) => !current)}>
                  <Archive aria-hidden="true" />
                  {showArchived ? 'Esconder arquivados' : `Mostrar arquivados (${archivedCount})`}
                </Button>
              )}
            </div>
            {archive.isLoading && <p role="status" className="text-sm text-muted-foreground">A carregar documentos...</p>}
            {archive.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os documentos.</p>}
            {!archive.isLoading && !archive.isError && visibleDocuments.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Ainda não existem documentos. Arraste um ficheiro para um dos cartões acima.
              </p>
            )}
            {visibleDocuments.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {visibleDocuments.map((item) => (
                  <DocumentRow
                    key={item.documentId}
                    item={item}
                    canManage={canManage}
                    pendingAction={pendingAction}
                    onOpenVersion={openVersion}
                    onNewVersion={() => openUpload({ document: item })}
                    onArchive={() => setArchiveTarget(item)}
                  />
                ))}
              </ul>
            )}
          </section>
          {message && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <ClientDocumentUploadDialog
        open={uploadPreset !== null}
        onOpenChange={(open) => { if (!open) setUploadPreset(null); }}
        clientId={clientId}
        people={people}
        preset={uploadPreset ?? {}}
        onUploaded={setMessage}
      />

      <AlertDialog open={archiveTarget !== null} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar documento?</AlertDialogTitle>
            <AlertDialogDescription>O documento deixa de estar disponível para novos envios. O histórico não é apagado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveDocument.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={archiveDocument.isPending} onClick={() => void confirmArchive()}>
              {archiveDocument.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type RequirementTileProps = {
  readonly requirement: ClientDocumentRequirement;
  readonly certificate: ClientCertificateHistoryRow | null;
  readonly certificates: readonly ClientCertificateHistoryRow[];
  readonly canManage: boolean;
  readonly pendingAction: PendingAction | null;
  readonly onOpenVersion: OpenVersion;
  readonly onUpload: (preset: ClientDocumentUploadPreset) => void;
  readonly onRenewCertificate?: (currentVersion: ClientCertificateHistoryRow | null) => void;
};

function RequirementTile({ requirement, certificate, certificates, canManage, pendingAction, onOpenVersion, onUpload, onRenewCertificate }: RequirementTileProps) {
  const [isDragging, setIsDragging] = useState(false);
  const meta = REQUIREMENT_META[requirement.category];
  // Na CRC, o código registado (consulta/renovação) conta como documento mesmo sem ficheiro carregado.
  // Estado e data vêm sempre da mesma fonte: o ficheiro, ou a certidão quando não há ficheiro ou o ficheiro não tem validade.
  const useCertificate = certificate !== null && (requirement.status === 'missing' || requirement.status === 'unknown');
  const status: ClientDocumentRequirementStatus = useCertificate
    ? clientDocumentDateStatus(certificate.valid_until, lisbonToday())
    : requirement.status;
  const validUntil = useCertificate ? certificate.valid_until : requirement.validUntil;
  const style = STATUS_STYLES[status];
  const StatusIcon = style.icon;
  const TileIcon = meta.icon;
  const version = requirement.version;
  const viewPending = version !== null && pendingAction?.versionId === version.version_id;
  const uploadPreset: ClientDocumentUploadPreset = {
    category: requirement.category,
    side: requirement.missingSide ?? undefined,
    document: requirement.document ?? undefined,
  };

  // O browser abre ficheiros largados fora de uma zona que os aceite; sem permissão, o ficheiro é só ignorado.
  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (canManage && file) onUpload({ ...uploadPreset, file });
  };

  return (
    <div
      className={cn('flex flex-col gap-3 rounded-lg border p-3 transition-colors', style.tile, isDragging && 'border-primary bg-primary/5')}
      onDragEnter={(event) => { event.preventDefault(); if (canManage) setIsDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setIsDragging(false)}
      onDrop={dropFile}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <TileIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{meta.label}</p>
          <p className={cn('mt-1 flex items-center gap-1 text-xs', style.text)}>
            <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {statusText(status, validUntil, requirement.missingSide)}
          </p>
          {certificate?.crc_code && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{certificate.crc_code}</p>}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-1">
        {version && (
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={viewPending} onClick={() => void onOpenVersion(version, 'view')}>
            {viewPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}Ver
          </Button>
        )}
        {canManage && (
          <Button type="button" variant={status === 'missing' ? 'default' : 'ghost'} size="sm" className="h-7 px-2 text-xs" onClick={() => onUpload(uploadPreset)}>
            <Upload aria-hidden="true" />
            {status === 'missing' ? 'Carregar' : requirement.missingSide ? `Carregar ${requirement.missingSide === 'back' ? 'verso' : 'frente'}` : 'Substituir'}
          </Button>
        )}
        {requirement.category === 'CRC' && onRenewCertificate && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onRenewCertificate(certificate)}>
            <RefreshCw aria-hidden="true" />Renovar
          </Button>
        )}
        {certificates.length > 0 && <CertificateHistoryPopover certificates={certificates} />}
      </div>
    </div>
  );
}

const CERTIFICATE_SOURCE_LABELS = {
  legacy: 'Legado',
  manual: 'Manual',
  crc_lookup: 'Consulta CRC',
} as const satisfies Record<ClientCertificateHistoryRow['source'], string>;

function CertificateHistoryPopover({ certificates }: { readonly certificates: readonly ClientCertificateHistoryRow[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <History aria-hidden="true" />Histórico ({certificates.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <p className="border-b px-3 py-2 text-sm font-medium">Histórico da certidão</p>
        <ul className="max-h-72 divide-y overflow-y-auto">
          {certificates.map((certificate) => (
            <li key={certificate.version_id} className="space-y-0.5 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{certificate.crc_code ?? 'Sem código'}</span>
                {certificate.is_current && <Badge variant="secondary" className="text-[10px]">Atual</Badge>}
              </div>
              <p className="text-muted-foreground">
                {certificate.valid_until ? `Válida até ${formatDate(certificate.valid_until)}` : 'Sem validade confirmada'}
                {' · '}{CERTIFICATE_SOURCE_LABELS[certificate.source]}
              </p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

type DocumentRowProps = {
  readonly item: ClientDocumentArchiveItem;
  readonly canManage: boolean;
  readonly pendingAction: PendingAction | null;
  readonly onOpenVersion: OpenVersion;
  readonly onNewVersion: () => void;
  readonly onArchive: () => void;
};

const VALIDITY_CHIP_STYLES = {
  valid: 'text-success',
  expiring: 'text-amber-800 dark:text-amber-300',
  expired: 'text-destructive',
  unknown: 'text-muted-foreground',
} as const satisfies Record<ClientDocumentDateStatus, string>;

function DocumentRow({ item, canManage, pendingAction, onOpenVersion, onNewVersion, onArchive }: DocumentRowProps) {
  const [showVersions, setShowVersions] = useState(false);
  const current = item.versions[0];
  const previous = item.versions.slice(1);
  const validity = current ? clientDocumentValidity(current) : null;
  const validityStatus = clientDocumentDateStatus(validity?.date ?? null, lisbonToday());
  const viewPending = current !== undefined && pendingAction?.versionId === current.version_id && pendingAction.action === 'view';

  return (
    <li className={cn(item.archivedAt && 'bg-muted/30')}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
          disabled={!current}
          onClick={() => current && void onOpenVersion(current, 'view')}
        >
          {viewPending
            ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
            : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium hover:underline">{item.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {item.category} · {item.personName ?? 'Empresa'}
              {current && current.side !== 'single' && ` · ${clientDocumentSideLabel(current.side)}`}
              {current && ` · ${formatDate(current.created_at)}`}
            </span>
          </span>
        </button>
        {item.archivedAt && <Badge variant="outline" className="text-xs">Arquivado</Badge>}
        {validity?.date && (
          <span className={cn('hidden shrink-0 text-xs sm:inline', VALIDITY_CHIP_STYLES[validityStatus])}>
            {validityStatus === 'expired' ? 'Expirou' : 'Até'} {formatDate(validity.date)}{validity.kind === 'suggested' && '*'}
          </span>
        )}
        {previous.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            aria-expanded={showVersions}
            aria-label={`${item.versions.length} versões`}
            onClick={() => setShowVersions((open) => !open)}
          >
            v{item.versions.length}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Ações de ${item.label}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {current && (
              <>
                <DropdownMenuItem onSelect={() => void onOpenVersion(current, 'view')}><Eye className="mr-2 h-4 w-4" />Ver</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void onOpenVersion(current, 'download')}><Download className="mr-2 h-4 w-4" />Descarregar</DropdownMenuItem>
              </>
            )}
            {canManage && !item.archivedAt && (
              <>
                <DropdownMenuItem onSelect={onNewVersion}><Upload className="mr-2 h-4 w-4" />Nova versão</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onArchive}><Archive className="mr-2 h-4 w-4" />Arquivar</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {showVersions && (
        <ul className="space-y-1 border-t bg-muted/20 px-3 py-2 pl-10">
          {previous.map((version) => (
            <li key={version.version_id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">
                {version.original_name}
                <span className="text-muted-foreground">
                  {version.side !== 'single' && ` · ${clientDocumentSideLabel(version.side)}`} · {formatDateTime(version.created_at)}
                </span>
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Ver versão" onClick={() => void onOpenVersion(version, 'view')}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Descarregar versão" onClick={() => void onOpenVersion(version, 'download')}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
