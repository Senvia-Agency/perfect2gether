import { Download, History, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EdpDispatchHistory } from "@/lib/edp/validation";
import { getEdpTransportLabel } from "../logic";

type EdpHistoryProps = {
  readonly entries: readonly EdpDispatchHistory[];
  readonly onDownload: (versionId: string) => Promise<void>;
};

export function EdpHistory({ entries, onDownload }: EdpHistoryProps) {
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (versionId: string) => {
    setPendingVersion(versionId);
    setError(null);
    try {
      await onDownload(versionId);
    } catch (downloadError) {
      if (downloadError instanceof Error) setError(downloadError.message);
      else throw downloadError;
    } finally {
      setPendingVersion(null);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="edp-history-title">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 id="edp-history-title" className="text-sm font-semibold">Histórico imutável</h3>
          <p className="text-xs text-muted-foreground">Cada entrada usa o snapshot e os anexos congelados no envio.</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Ainda não existem tentativas de envio EDP.</p>
      ) : entries.map((entry) => (
        <article key={entry.dispatch_id} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{entry.snapshot.delivery.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString("pt-PT")} · autor {entry.created_by_name || entry.created_by.slice(0, 8)}
                </p>
              </div>
            </div>
            <DispatchStateBadge state={entry.state} />
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Cliente no envio</dt><dd>{entry.snapshot.client.name}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Proposta</dt><dd className="font-mono">{entry.snapshot.sale.proposal_number}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Para</dt><dd className="break-all">{entry.snapshot.delivery.to.join(", ")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">CC</dt><dd className="break-all">{entry.snapshot.delivery.cc.join(", ") || "Sem CC"}</dd></div>
          </dl>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Anexos autorizados</p>
            {entry.attachment_manifest.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem anexos.</p>
            ) : entry.attachment_manifest.map((item) => (
              <div key={item.version_id} className="flex min-w-0 items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                <span className="min-w-0 flex-1 break-all text-xs">{item.filename} · {item.sha256.slice(0, 12)}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Descarregar ${item.filename}`}
                  disabled={pendingVersion === item.version_id}
                  onClick={() => void download(item.version_id)}
                >
                  {pendingVersion === item.version_id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Download className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        </article>
      ))}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

function DispatchStateBadge({ state }: { readonly state: EdpDispatchHistory["state"] }) {
  if (state === "accepted") return <Badge className="bg-emerald-600">{getEdpTransportLabel(state)}</Badge>;
  if (state === "failed") return <Badge variant="destructive">{getEdpTransportLabel(state)}</Badge>;
  if (state === "uncertain") return <Badge className="bg-amber-600">{getEdpTransportLabel(state)}</Badge>;
  return <Badge variant="secondary">Reservado</Badge>;
}
