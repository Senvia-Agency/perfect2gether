import type { ReactNode } from "react";
import { Zap, Wrench } from "lucide-react";

interface TypeSplitProps {
  energia: ReactNode;
  servicos: ReactNode;
  energiaUnit?: string;
  servicosUnit?: string;
}

/**
 * Breakdown Energia / Servicos apresentado dentro de um card de resumo.
 * Usado nos cards de Propostas e Vendas.
 */
export function TypeSplit({ energia, servicos, energiaUnit, servicosUnit }: TypeSplitProps) {
  return (
    <div className="mt-2 space-y-1 border-t pt-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
          <Zap className="h-3 w-3" />
          Energia
        </span>
        <span className="text-right">
          <span className="font-medium text-foreground tabular-nums">{energia}</span>
          {energiaUnit && <span className="text-muted-foreground"> · {energiaUnit}</span>}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
          <Wrench className="h-3 w-3" />
          Serviços
        </span>
        <span className="text-right">
          <span className="font-medium text-foreground tabular-nums">{servicos}</span>
          {servicosUnit && <span className="text-muted-foreground"> · {servicosUnit}</span>}
        </span>
      </div>
    </div>
  );
}
