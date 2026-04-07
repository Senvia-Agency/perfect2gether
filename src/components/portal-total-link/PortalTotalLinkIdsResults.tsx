import { Search, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortalTotalLinkFilters } from "./PortalTotalLinkContext";

export function PortalTotalLinkIdsResults() {
  const { activeFilterCount } = usePortalTotalLinkFilters();

  if (activeFilterCount === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/30">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Utilize os filtros acima para pesquisar identificadores
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identificador</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Estado BO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/30">
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Sem resultados</p>
                      <p className="text-xs text-muted-foreground">
                        A pesquisa será ligada ao PHC CS numa fase posterior.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
