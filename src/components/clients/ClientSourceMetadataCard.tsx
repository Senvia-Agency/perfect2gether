import { AlertTriangle, Building2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseClientSourceMetadata } from "@/lib/client-certificate";

interface ClientSourceMetadataCardProps {
  readonly value: unknown;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00Z`));
}

export function ClientSourceMetadataCard({ value }: ClientSourceMetadataCardProps) {
  const metadata = parseClientSourceMetadata(value);
  if (!metadata) return null;
  const hasOrigin = !!metadata.source_portal || !!metadata.publication_date || !!metadata.lead_source;
  if (!hasOrigin && !metadata.cae && !metadata.cae_review) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Origem e atividade
          {metadata.cae_review && <Badge variant="outline" className="ml-auto border-warning/40 bg-warning/10 text-warning-foreground">Revisão necessária</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasOrigin && (
          <section className="space-y-2 text-sm">
            <h3 className="font-medium">Origem</h3>
            {metadata.source_portal && (
              <div className="flex items-start gap-2">
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="break-words">
                  {metadata.source_portal === "publicacoes.mj.pt"
                    ? "Publicações do Ministério da Justiça"
                    : metadata.source_portal}
                </span>
              </div>
            )}
            {metadata.publication_date && <p className="text-muted-foreground">Publicação: {dateLabel(metadata.publication_date)}</p>}
            {metadata.origins && metadata.origins.length > 1 && <p className="text-muted-foreground">{metadata.origins.length} origens preservadas no histórico.</p>}
          </section>
        )}

        {metadata.cae && (
          <section className="space-y-2 border-t pt-4 text-sm">
            <h3 className="font-medium">Atividade económica</h3>
            <p><span className="text-muted-foreground">CAE principal:</span> {metadata.cae.principal}</p>
            {metadata.cae.secundarios.length > 0 && (
              <p className="break-words"><span className="text-muted-foreground">CAE secundários:</span> {metadata.cae.secundarios.join(", ")}</p>
            )}
          </section>
        )}

        {metadata.cae_review && (
          <section role="alert" className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
              <div className="space-y-1">
                <p className="font-medium">CAE recebido não aplicado automaticamente</p>
                <p className="text-muted-foreground">O CAE atual foi preservado. Compare antes de aplicar o CAE {metadata.cae_review.incoming.principal}.</p>
              </div>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
