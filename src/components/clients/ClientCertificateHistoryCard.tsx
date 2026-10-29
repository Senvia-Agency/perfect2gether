import { CalendarDays, FileClock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientCertificateHistory } from "@/hooks/useClientEdpData";
import {
  certificateValidity,
  type ClientCertificateHistoryRow,
} from "@/lib/client-certificate";

interface ClientCertificateHistoryCardProps {
  readonly clientId: string;
  readonly onRenew?: (currentVersion: ClientCertificateHistoryRow | null) => void;
}

const sourceLabels = {
  legacy: "Legado",
  manual: "Manual",
  crc_lookup: "Consulta CRC",
} as const;

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00Z`));
}

function ValidityBadge({ validUntil }: { readonly validUntil: string | null }) {
  const validity = certificateValidity(validUntil);
  if (validity === "valid") return <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Válida</Badge>;
  if (validity === "expired") return <Badge variant="destructive">Expirada</Badge>;
  return <Badge variant="outline" className="border-warning/40 bg-warning/10 text-amber-900 dark:text-amber-200">Validade desconhecida</Badge>;
}

export function ClientCertificateHistoryCard({ clientId, onRenew }: ClientCertificateHistoryCardProps) {
  const history = useClientCertificateHistory(clientId);
  const versions = history.data ?? [];
  const current = versions.find(version => version.is_current) ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <FileClock className="h-4 w-4" />
          Certidão Permanente
          {onRenew && (
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => onRenew(current)}>
              <RefreshCw className="mr-2 h-4 w-4" />Renovar
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.isLoading && <p role="status" className="text-sm text-muted-foreground">A carregar histórico CRC...</p>}
        {history.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o histórico CRC.</p>}
        {!history.isLoading && !history.isError && versions.length === 0 && <p className="text-sm text-muted-foreground">Sem versões CRC registadas.</p>}
        {versions.map(version => (
          <section key={version.version_id} className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono font-medium">{version.crc_code ?? "Sem código"}</p>
                <p className="text-xs text-muted-foreground">{sourceLabels[version.source]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {version.is_current && <Badge variant="secondary">Atual</Badge>}
                <ValidityBadge validUntil={version.valid_until} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{version.valid_until ? `Válida até ${dateLabel(version.valid_until)}` : "Sem validade confirmada"}</span>
            </div>
            <p className="text-xs text-muted-foreground">Registada em {new Date(version.recorded_at).toLocaleString("pt-PT")}</p>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
