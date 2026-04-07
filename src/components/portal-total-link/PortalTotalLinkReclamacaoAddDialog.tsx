import { useState } from "react";
import { Search, User, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PortalTotalLinkReclamacaoAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PortalTotalLinkReclamacaoAddDialog({
  open,
  onOpenChange,
}: PortalTotalLinkReclamacaoAddDialogProps) {
  const [nif, setNif] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!nif.trim()) return;
    setIsSearching(true);
    setHasSearched(false);

    // Placeholder: futura integração com PHC CS via edge function
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSearching(false);
    setHasSearched(true);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setNif("");
      setIsSearching(false);
      setHasSearched(false);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent variant="fullScreen">
        <DialogHeader>
          <DialogTitle>Adicionar Reclamação</DialogTitle>
          <DialogDescription>
            Indique o NIF do cliente e verifique se o mesmo já existe ou se será necessário criar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="flex gap-2">
            <Input
              placeholder="Introduza o NIF"
              value={nif}
              onChange={(e) => {
                setNif(e.target.value);
                setHasSearched(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={!nif.trim() || isSearching}
              className="shrink-0"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Pesquisar
            </Button>
          </div>

          {hasSearched && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/30">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Nenhum cliente encontrado</p>
                  <p className="text-xs text-muted-foreground">
                    A pesquisa será ligada ao PHC CS numa fase posterior.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
