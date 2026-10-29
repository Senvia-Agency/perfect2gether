import { AlertCircle, Loader2, RefreshCw, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { RenewClientCertificateModal } from "@/components/clients/RenewClientCertificateModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clientCertificateHistoryRowSchema } from "@/lib/client-certificate";
import { isEdpLocalCaptureAvailable, isEdpUiAvailable } from "../environment";
import { useEdpSale } from "../useEdp";
import { EdpWorkspaceView } from "./EdpWorkspaceView";

type EdpSaleEntryProps = {
  readonly saleId: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly canManage: boolean;
};

export function EdpSaleEntry({ saleId, clientId, clientName, canManage }: EdpSaleEntryProps) {
  const uiAvailable = isEdpUiAvailable();
  const [open, setOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const edp = useEdpSale(saleId, open && uiAvailable);
  const context = edp.contextQuery.data;
  const currentCertificate = useMemo(() => {
    const current = context?.certificate_history.find((item) => item.is_current);
    const parsed = clientCertificateHistoryRowSchema.safeParse(current);
    return parsed.success ? parsed.data : null;
  }, [context?.certificate_history]);

  if (!uiAvailable) return null;

  const captureAllowed = Boolean(
    context?.settings.send_enabled
    && context.settings.transport === "local_capture"
    && isEdpLocalCaptureAvailable(),
  );
  const transportDescription = getTransportDescription(context?.settings.send_enabled ?? false, context?.settings.transport);

  return (
    <>
      <Button type="button" variant="p2g" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        <Send className="mr-2 h-4 w-4" />Preparar processo EDP
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[calc(100dvh-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(48rem,calc(100dvh-2rem))]">
          <DialogHeader className="border-b px-4 py-4 sm:px-6">
            <DialogTitle>Processo EDP</DialogTitle>
            <DialogDescription>Dados, documentos, revisão e histórico desta venda.</DialogDescription>
          </DialogHeader>
          {edp.contextQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : edp.contextQuery.error || !context ? (
            <div className="p-4 sm:p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível abrir o processo</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>{edp.contextQuery.error instanceof Error ? edp.contextQuery.error.message : "Resposta EDP indisponível."}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void edp.contextQuery.refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <EdpWorkspaceView
              context={context}
              canManage={canManage}
              onSave={edp.saveDraft}
              onUpload={edp.uploadDocument}
              onDownload={edp.downloadDocument}
              onDispatch={edp.dispatchSale}
              onRenewCertificate={() => setRenewOpen(true)}
              onReloadRevision={edp.reloadRevision}
              transportEnabled={captureAllowed}
              transportDescription={transportDescription}
            />
          )}
        </DialogContent>
      </Dialog>
      <RenewClientCertificateModal
        target={{ id: clientId, name: clientName }}
        currentVersion={currentCertificate}
        open={renewOpen}
        onOpenChange={setRenewOpen}
        onRenewed={() => void edp.refresh()}
      />
    </>
  );
}

function getTransportDescription(enabled: boolean, transport: "local_capture" | "brevo" | undefined): string {
  if (!enabled) return "O envio EDP está desativado no backend.";
  if (transport !== "local_capture") return "O envio está desativado nesta interface.";
  return "O envio de teste está desativado neste ambiente.";
}
