import { AlertTriangle, Check, FileText, History, Loader2, Save, Send } from "lucide-react";
import { useReducer, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  EdpDispatchEdgeResponse,
  EdpDocumentUploadResponse,
  EdpDraftPayload,
  EdpSaleContext,
  EdpSavedDraft,
} from "@/lib/edp/validation";
import type { EdpDocumentUploadInput } from "../api";
import { EdpRevisionConflictError } from "../api-errors";
import { createEdpDraftState, edpDraftReducer } from "../draft-state";
import { nextDispatchKey, type DispatchOutcome } from "../logic";
import { EdpDocumentsStep } from "./EdpDocumentsStep";
import { EdpHistory } from "./EdpHistory";
import { EdpReviewStep } from "./EdpReviewStep";
import { EdpSaleDataStep } from "./EdpSaleDataStep";

type EdpWorkspaceViewProps = {
  readonly context: EdpSaleContext;
  readonly canManage: boolean;
  readonly onSave: (revision: number, payload: EdpDraftPayload) => Promise<EdpSavedDraft>;
  readonly onUpload: (input: EdpDocumentUploadInput) => Promise<EdpDocumentUploadResponse>;
  readonly onDownload: (versionId: string) => Promise<void>;
  readonly onDispatch: (revision: number, idempotencyKey: string) => Promise<EdpDispatchEdgeResponse>;
  readonly onRenewCertificate: () => void;
  readonly onReloadRevision: () => Promise<number>;
  readonly transportEnabled: boolean;
  readonly transportDescription: string;
};

export function EdpWorkspaceView({
  context,
  canManage,
  onSave,
  onUpload,
  onDownload,
  onDispatch,
  onRenewCertificate,
  onReloadRevision,
  transportEnabled,
  transportDescription,
}: EdpWorkspaceViewProps) {
  const [draft, dispatchDraft] = useReducer(edpDraftReducer, context, createEdpDraftState);
  const [savePending, setSavePending] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dispatchPending, setDispatchPending] = useState(false);
  const [dispatchOutcome, setDispatchOutcome] = useState<DispatchOutcome>("idle");
  const [dispatchKey, setDispatchKey] = useState<string | null>(null);
  const [dispatchResult, setDispatchResult] = useState<EdpDispatchEdgeResponse | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const dispatchInFlight = useRef(false);

  const edit = (payload: EdpDraftPayload) => dispatchDraft({ type: "edit", payload });

  const save = async () => {
    setSavePending(true);
    setSaveMessage(null);
    try {
      const saved = await onSave(draft.revision, draft.payload);
      dispatchDraft({ type: "save_succeeded", draft: saved });
      setSaveMessage(saved.readiness === "ready" ? "Rascunho guardado e pronto para revisão." : "Rascunho guardado com pontos por concluir.");
    } catch (error) {
      dispatchDraft({ type: "save_failed" });
      if (error instanceof EdpRevisionConflictError) {
        dispatchDraft({ type: "revision_conflict" });
        setSaveMessage("Outra pessoa guardou esta venda. As suas alterações locais foram mantidas.");
      } else if (error instanceof Error) {
        setSaveMessage(error.message);
      } else {
        throw error;
      }
    } finally {
      setSavePending(false);
    }
  };

  const reviewConflict = async () => {
    setSavePending(true);
    try {
      const revision = await onReloadRevision();
      dispatchDraft({ type: "rebase_revision", revision });
      setSaveMessage("Versão atualizada. Reveja as alterações locais antes de guardar novamente.");
    } catch (error) {
      if (error instanceof Error) setSaveMessage(error.message);
      else throw error;
    } finally {
      setSavePending(false);
    }
  };

  const send = async () => {
    if (dispatchInFlight.current) return;
    dispatchInFlight.current = true;
    const nextKey = nextDispatchKey(dispatchOutcome, dispatchKey, () => crypto.randomUUID());
    if (!nextKey) {
      dispatchInFlight.current = false;
      return;
    }

    setDispatchKey(nextKey);
    setDispatchPending(true);
    setDispatchError(null);
    try {
      const response = await onDispatch(draft.revision, nextKey);
      setDispatchResult(response);
      if (response.state === "accepted") setDispatchOutcome("accepted");
      else if (response.state === "failed") setDispatchOutcome("failed");
      else if (response.state === "uncertain") setDispatchOutcome("uncertain");
      else {
        setDispatchOutcome("transport_error");
        setDispatchError("A tentativa ficou reservada. Verifique novamente com a mesma chave.");
      }
    } catch (error) {
      setDispatchOutcome("transport_error");
      if (error instanceof Error) setDispatchError(error.message);
      else throw error;
    } finally {
      dispatchInFlight.current = false;
      setDispatchPending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{context.client.name}</p>
          <p className="text-xs text-muted-foreground">Proposta {draft.payload.proposal_number || "por preencher"} · revisão {draft.revision}</p>
        </div>
        <ReadinessBadge readiness={draft.readiness} dirty={draft.dirty} />
      </div>

      {draft.hasConflict && (
        <div className="px-4 pt-4 sm:px-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Conflito de edição</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>O rascunho local continua visível. Carregue a revisão atual e confirme as diferenças.</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void reviewConflict()} disabled={savePending}>Rever versão</Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Tabs defaultValue="data" className="flex min-h-0 flex-1 flex-col">
        <div className="overflow-x-auto border-b px-4 py-3 sm:px-6">
          <TabsList className="grid min-w-[36rem] grid-cols-4">
            <TabsTrigger value="data"><FileText className="mr-2 h-4 w-4" />Dados</TabsTrigger>
            <TabsTrigger value="documents"><Check className="mr-2 h-4 w-4" />Documentos</TabsTrigger>
            <TabsTrigger value="review"><Send className="mr-2 h-4 w-4" />Rever</TabsTrigger>
            <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />Histórico</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <TabsContent value="data" className="m-0">
            <EdpSaleDataStep
              payload={draft.payload}
              people={context.people}
              certificates={context.certificate_history}
              negotiationType={context.sale.negotiation_type}
              onChange={edit}
              onRenewCertificate={onRenewCertificate}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="documents" className="m-0">
            <EdpDocumentsStep
              clientId={context.client.id}
              payload={draft.payload}
              documents={context.documents}
              people={context.people}
              onChange={edit}
              onUpload={onUpload}
              onDownload={onDownload}
              canManage={canManage}
            />
          </TabsContent>
          <TabsContent value="review" className="m-0">
            <EdpReviewStep
              client={context.client}
              draft={draft}
              settings={context.settings}
              checklist={context.checklist}
              documents={context.documents}
              dispatchOutcome={dispatchOutcome}
              dispatchResult={dispatchResult}
              dispatchError={dispatchError}
              dispatchPending={dispatchPending}
              transportEnabled={transportEnabled}
              transportDescription={transportDescription}
              canManage={canManage}
              onChange={edit}
              onDispatch={() => void send()}
            />
          </TabsContent>
          <TabsContent value="history" className="m-0">
            <EdpHistory entries={context.history} onDownload={onDownload} />
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background px-4 py-3 sm:px-6">
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {saveMessage ?? (!canManage ? "Modo de consulta: edição e envio indisponíveis." : null)}
        </p>
        {canManage && (
          <Button type="button" onClick={() => void save()} disabled={!draft.dirty || savePending || draft.hasConflict}>
            {savePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {savePending ? "A guardar..." : "Guardar rascunho"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReadinessBadge({ readiness, dirty }: { readonly readiness: EdpDraftStateReadiness; readonly dirty: boolean }) {
  if (dirty) return <Badge variant="secondary">Alterações por guardar</Badge>;
  if (readiness === "ready") return <Badge className="bg-emerald-600">Pronto</Badge>;
  if (readiness === "blocked") return <Badge variant="destructive">Bloqueado</Badge>;
  return <Badge variant="secondary">Rascunho</Badge>;
}

type EdpDraftStateReadiness = ReturnType<typeof createEdpDraftState>["readiness"];
