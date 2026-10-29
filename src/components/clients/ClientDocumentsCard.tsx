import { Archive, Download, Eye, FileText, Files, History, Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

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
import { useArchiveClientDocument, useClientDocuments } from '@/hooks/useClientDocuments';
import {
  clientDocumentSideLabel,
  clientDocumentValidity,
  type ClientDocumentArchiveItem,
} from '@/lib/client-documents';
import type { EdpDocumentVersion } from '@/lib/edp/validation';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getEdpSignedUrl } from '@/modules/edp/api';
import { ClientDocumentUploadForm } from './ClientDocumentUploadForm';

type ClientDocumentsCardProps = {
  readonly clientId: string;
  readonly canManage: boolean;
  readonly openUploadRequest?: number;
};

type VersionAction = 'view' | 'download';
type PendingAction = { readonly versionId: string; readonly action: VersionAction };

const FILE_TYPE_LABELS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Imagem JPG',
  'image/png': 'Imagem PNG',
} as const satisfies Record<EdpDocumentVersion['mime_type'], string>;

export function ClientDocumentsCard({ clientId, canManage, openUploadRequest = 0 }: ClientDocumentsCardProps) {
  const archive = useClientDocuments(clientId);
  const archiveDocument = useArchiveClientDocument(clientId);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientDocumentArchiveItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const documents = archive.data?.documents ?? [];
  const people = archive.data?.people ?? [];
  const activeCount = documents.filter((document) => !document.archivedAt).length;

  useEffect(() => {
    if (canManage && openUploadRequest > 0) setShowUpload(true);
  }, [canManage, openUploadRequest]);

  const openVersion = async (versionId: string, filename: string, action: VersionAction) => {
    setPendingAction({ versionId, action });
    setMessage(null);
    try {
      const signed = await getEdpSignedUrl(versionId);
      const link = document.createElement('a');
      link.href = signed.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (action === 'download') link.download = filename;
      link.click();
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
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Files className="h-4 w-4" aria-hidden="true" />
                Documentos
                <Badge variant="outline">{activeCount}</Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Documentos do cliente e das pessoas associadas.</p>
            </div>
            {canManage && (
              <Button type="button" size="sm" aria-expanded={showUpload} onClick={() => setShowUpload((current) => !current)}>
                <Plus aria-hidden="true" />Adicionar documento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          {showUpload && canManage && (
            <ClientDocumentUploadForm clientId={clientId} people={people} onCancel={() => setShowUpload(false)} />
          )}
          {archive.isLoading && <p role="status" className="text-sm text-muted-foreground">A carregar documentos...</p>}
          {archive.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os documentos.</p>}
          {!showUpload && !archive.isLoading && !archive.isError && documents.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-center">
              <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">Ainda não existem documentos</p>
              <p className="mt-1 text-xs text-muted-foreground">Adicione o primeiro ficheiro deste cliente.</p>
            </div>
          )}
          <div className="space-y-3">
            {documents.map((item) => (
              <DocumentEntry
                key={item.documentId}
                item={item}
                canManage={canManage}
                pendingAction={pendingAction}
                onOpenVersion={openVersion}
                onArchive={setArchiveTarget}
              />
            ))}
          </div>
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
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

type DocumentEntryProps = {
  readonly item: ClientDocumentArchiveItem;
  readonly canManage: boolean;
  readonly pendingAction: PendingAction | null;
  readonly onOpenVersion: (versionId: string, filename: string, action: VersionAction) => Promise<void>;
  readonly onArchive: (item: ClientDocumentArchiveItem) => void;
};

function DocumentEntry({ item, canManage, pendingAction, onOpenVersion, onArchive }: DocumentEntryProps) {
  const currentVersion = item.versions[0];
  const previousVersions = item.versions.slice(1);

  return (
    <article className={cn('space-y-3 rounded-lg border p-4', item.archivedAt && 'bg-muted/30')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{item.category}</Badge>
            {item.archivedAt && <Badge variant="outline">Arquivado</Badge>}
          </div>
          <h4 className="break-words text-sm font-semibold">{item.label}</h4>
          <p className="text-xs text-muted-foreground">Associado a {item.personName ?? 'Cliente / empresa'}</p>
        </div>
        {canManage && !item.archivedAt && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onArchive(item)}>
            <Archive aria-hidden="true" />Arquivar
          </Button>
        )}
      </div>
      {currentVersion ? (
        <DocumentVersionRow version={currentVersion} current pendingAction={pendingAction} onOpenVersion={onOpenVersion} />
      ) : (
        <p className="text-sm text-muted-foreground">Sem ficheiros disponíveis.</p>
      )}
      {previousVersions.length > 0 && (
        <details className="rounded-md border bg-muted/20 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <History className="h-4 w-4" aria-hidden="true" />
            {previousVersions.length} {previousVersions.length === 1 ? 'versão anterior' : 'versões anteriores'}
          </summary>
          <div className="mt-3 space-y-2 border-t pt-3">
            {previousVersions.map((version) => (
              <DocumentVersionRow key={version.version_id} version={version} current={false} pendingAction={pendingAction} onOpenVersion={onOpenVersion} />
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

type DocumentVersionRowProps = {
  readonly version: EdpDocumentVersion;
  readonly current: boolean;
  readonly pendingAction: PendingAction | null;
  readonly onOpenVersion: (versionId: string, filename: string, action: VersionAction) => Promise<void>;
};

function DocumentVersionRow({ version, current, pendingAction, onOpenVersion }: DocumentVersionRowProps) {
  const validity = clientDocumentValidity(version);
  const viewPending = pendingAction?.versionId === version.version_id && pendingAction.action === 'view';
  const downloadPending = pendingAction?.versionId === version.version_id && pendingAction.action === 'download';

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-md bg-background p-3 sm:flex-row sm:items-center">
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-all text-sm font-medium">{version.original_name}</p>
          {current && <Badge variant="outline">Atual</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {FILE_TYPE_LABELS[version.mime_type]} · {formatBytes(version.size_bytes)}
          {version.side === 'single' ? '' : ` · ${clientDocumentSideLabel(version.side)}`}
          {' · '}{formatDateTime(version.created_at)}
        </p>
        <ValidityLabel validity={validity} />
      </div>
      <div className="flex flex-wrap gap-1 sm:shrink-0">
        <Button type="button" variant="ghost" size="sm" disabled={viewPending} onClick={() => void onOpenVersion(version.version_id, version.original_name, 'view')}>
          {viewPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}Ver
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={downloadPending} onClick={() => void onOpenVersion(version.version_id, version.original_name, 'download')}>
          {downloadPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}Descarregar
        </Button>
      </div>
    </div>
  );
}

function ValidityLabel({ validity }: { readonly validity: ReturnType<typeof clientDocumentValidity> }) {
  if (validity.kind === 'confirmed') return <p className="text-xs text-success">Válido até {formatDate(validity.date)}</p>;
  if (validity.kind === 'suggested') return <p className="text-xs text-amber-900 dark:text-amber-200">Data sugerida: {formatDate(validity.date)} · por confirmar</p>;
  return <p className="text-xs text-muted-foreground">Sem validade indicada</p>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} KiB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} MiB`;
}
