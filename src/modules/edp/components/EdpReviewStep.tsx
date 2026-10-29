import { AlertCircle, CheckCircle2, Loader2, Mail, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { buildEdpPreview, EdpTemplateError } from "@/lib/edp/template";
import type {
  EdpChecklistRule,
  EdpDispatchEdgeResponse,
  EdpDocumentVersion,
  EdpDraftPayload,
  EdpSettings,
} from "@/lib/edp/validation";
import type { EdpDraftState } from "../draft-state";
import { getEdpTransportLabel, type DispatchOutcome } from "../logic";
import { setChecklistConfirmation } from "../payload";

type EdpReviewStepProps = {
  readonly client: { readonly name: string; readonly nif: string | null };
  readonly draft: EdpDraftState;
  readonly settings: EdpSettings;
  readonly checklist: readonly EdpChecklistRule[];
  readonly documents: readonly EdpDocumentVersion[];
  readonly dispatchOutcome: DispatchOutcome;
  readonly dispatchResult: EdpDispatchEdgeResponse | null;
  readonly dispatchError: string | null;
  readonly dispatchPending: boolean;
  readonly transportEnabled: boolean;
  readonly transportDescription: string;
  readonly canManage: boolean;
  readonly onChange: (payload: EdpDraftPayload) => void;
  readonly onDispatch: () => void;
};

const BLOCKING_LABELS: Readonly<Record<string, string>> = {
  proposal_number_missing: "Número da proposta em falta",
  contract_start_date_missing: "Existe um CPE/CUI sem data contratual",
  direct_debit_missing: "Débito direto por decidir",
  electronic_invoice_missing: "Fatura eletrónica por decidir",
  billing_email_required: "Email de faturação obrigatório",
  decision_maker_incomplete: "Responsável incompleto",
  certificate_missing: "CRC em falta",
  certificate_validity_unknown: "Validade do CRC desconhecida",
  certificate_expired: "CRC expirada",
  selected_document_missing: "Documento selecionado indisponível",
  checklist_incomplete: "Checklist obrigatório incompleto",
  settings_missing: "Configuração EDP em falta",
};

export function EdpReviewStep({
  client,
  draft,
  settings,
  checklist,
  documents,
  dispatchOutcome,
  dispatchResult,
  dispatchError,
  dispatchPending,
  transportEnabled,
  transportDescription,
  canManage,
  onChange,
  onDispatch,
}: EdpReviewStepProps) {
  const applicableChecklist = checklist.filter((rule) => rule.energy_type === draft.payload.energy_type);
  const selectedDocuments = documents.filter((document) => draft.payload.selected_document_version_ids.includes(document.version_id));
  const preview = getPreview(settings, draft.payload, client);
  const canSend = canManage && draft.readiness === "ready" && !draft.dirty && !draft.hasConflict
    && transportEnabled && dispatchOutcome !== "accepted" && dispatchOutcome !== "uncertain";

  return (
    <div className="space-y-6">
      {!settings.officially_confirmed && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Configuração EDP não confirmada oficialmente</AlertTitle>
          <AlertDescription>Os destinatários ainda são de teste. A aceitação pelo transporte não prova entrega externa.</AlertDescription>
        </Alert>
      )}

      {!transportEnabled && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Envio desativado</AlertTitle>
          <AlertDescription>{transportDescription} A pré-visualização e o rascunho continuam disponíveis.</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3" aria-labelledby="edp-checklist-title">
        <div>
          <h3 id="edp-checklist-title" className="text-sm font-semibold">Checklist</h3>
          <p className="text-xs text-muted-foreground">As confirmações são revalidadas e congeladas pelo servidor.</p>
        </div>
        {applicableChecklist.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Sem regras configuradas para este tipo de energia.</p>
        ) : applicableChecklist.map((rule) => {
          const confirmed = draft.payload.checklist_confirmations.find((item) => item.rule_id === rule.id)?.confirmed ?? false;
          return (
            <Label key={rule.id} className="flex min-h-10 cursor-pointer items-start gap-3 rounded-lg border p-3">
              <Checkbox disabled={!canManage} checked={confirmed} onCheckedChange={(checked) => onChange(setChecklistConfirmation(draft.payload, rule.id, checked === true))} />
              <span className="text-sm">{rule.label}{rule.required ? " · obrigatório" : ""}</span>
            </Label>
          );
        })}
      </section>

      <section className="space-y-3" aria-labelledby="edp-email-preview-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="edp-email-preview-title" className="text-sm font-semibold">Pré-visualização</h3>
            <p className="text-xs text-muted-foreground">O servidor volta a renderizar e congela o conteúdo no envio.</p>
          </div>
          <Badge variant="outline">Para: {settings.to.join(", ") || "não configurado"}</Badge>
        </div>
        {preview.kind === "error" ? (
          <p role="alert" className="text-sm text-destructive">{preview.message}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="space-y-1 border-b bg-muted/30 p-3 text-sm">
              <p><span className="text-muted-foreground">Assunto:</span> {preview.subject}</p>
              <p className="break-all text-xs text-muted-foreground">CC: {settings.cc.join(", ") || "Sem CC"}</p>
            </div>
            <iframe title="Corpo do email EDP" sandbox="" srcDoc={preview.html} className="min-h-48 w-full bg-background" />
          </div>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="edp-manifest-title">
        <h3 id="edp-manifest-title" className="text-sm font-semibold">Manifesto candidato</h3>
        {selectedDocuments.length === 0 ? <p className="text-sm text-muted-foreground">Sem anexos selecionados.</p> : selectedDocuments.map((document) => (
          <div key={document.version_id} className="flex flex-wrap justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
            <span className="break-all">{document.original_name}</span>
            <span className="font-mono text-muted-foreground">v. {document.version_id.slice(0, 8)} · {document.sha256.slice(0, 12)}</span>
          </div>
        ))}
      </section>

      {draft.blockingReasons.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Processo ainda bloqueado</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {draft.blockingReasons.map((reason) => <li key={reason}>{BLOCKING_LABELS[reason] ?? reason}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {dispatchOutcome === "accepted" && dispatchResult && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{getEdpTransportLabel("accepted")}</AlertTitle>
          <AlertDescription>
            O transporte aceitou {dispatchResult.attachment_manifest.length} anexo(s). Não equivale a entregue nem aberto.
          </AlertDescription>
        </Alert>
      )}
      {dispatchOutcome === "uncertain" && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Resultado incerto</AlertTitle><AlertDescription>Não tente novamente. Reconcilie esta tentativa no histórico.</AlertDescription></Alert>
      )}
      {dispatchError && <p role="alert" className="text-sm text-destructive">{dispatchError}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">{draft.dirty ? "Guarde as alterações antes de enviar." : draft.readiness === "ready" ? "Processo pronto; confirme que o envio está autorizado." : "Complete os pontos em falta."}</p>
          <p className="text-xs text-muted-foreground">Duplo clique e replays usam uma única chave idempotente.</p>
        </div>
        <Button type="button" onClick={onDispatch} disabled={!canSend || dispatchPending || preview.kind === "error"}>
          {dispatchPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          {dispatchOutcome === "failed" ? "Tentar novo envio" : dispatchOutcome === "transport_error" ? "Verificar tentativa" : "Enviar processo EDP"}
        </Button>
      </div>
    </div>
  );
}

type PreviewResult = { readonly kind: "ok"; readonly subject: string; readonly html: string }
  | { readonly kind: "error"; readonly message: string };

function getPreview(settings: EdpSettings, draft: EdpDraftPayload, client: EdpReviewStepProps["client"]): PreviewResult {
  try {
    return { kind: "ok", ...buildEdpPreview({ settings, draft, client }) };
  } catch (error) {
    if (error instanceof EdpTemplateError) return { kind: "error", message: error.message };
    throw error;
  }
}
