
import { CommissionAnalysisTab } from "@/components/finance/CommissionAnalysisTab";
import { BarChart3 } from "lucide-react";

export default function Gestao() {
  return (
    <div className="space-y-6 p-4 pb-20 md:p-6 md:pb-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Gestão</h1>
        <p className="text-sm text-muted-foreground">Relatórios e análises gerenciais</p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Análise de Comissões</h2>
        </div>
        <CommissionAnalysisTab />
      </div>
    </div>
  );
}
