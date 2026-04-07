import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { usePortalTotalLinkFilters } from "./PortalTotalLinkContext";

interface PortalTotalLinkEmptyStateProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  columns: string[];
  note: string;
}

export function PortalTotalLinkEmptyState({
  eyebrow,
  title,
  description,
  icon: Icon,
  columns,
  note,
}: PortalTotalLinkEmptyStateProps) {
  const { filters, activeFilterCount } = usePortalTotalLinkFilters();

  const activeTags = [
    filters.period?.from || filters.period?.to ? "Período definido" : null,
    filters.clientQuery.trim() ? `Cliente: ${filters.clientQuery}` : null,
    filters.contractQuery.trim() ? `Contrato: ${filters.contractQuery}` : null,
    filters.sellerQuery.trim() ? `Vendedor: ${filters.sellerQuery}` : null,
    filters.cycle !== "all" ? `Ciclo: ${filters.cycle}` : null,
    filters.year !== "all" ? `Ano: ${filters.year}` : null,
    filters.commercialStatus !== "all" ? `Estado comercial: ${filters.commercialStatus}` : null,
    filters.boStatus !== "all" ? `Estado BO: ${filters.boStatus}` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Badge variant="outline">{eyebrow}</Badge>
              <CardTitle className="text-xl md:text-2xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/30">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-foreground">Estrutura preparada para futura listagem</p>
              <Badge variant="secondary">{activeFilterCount} filtro{activeFilterCount === 1 ? "" : "s"} ativo{activeFilterCount === 1 ? "" : "s"}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {columns.map((column) => (
                <div key={column} className="rounded-2xl border border-border bg-background/80 p-3 text-sm text-foreground">
                  {column}
                </div>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Resumo dos filtros atuais</p>
            {activeTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeTags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem filtros ativos neste momento.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            {note}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
