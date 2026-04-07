import { Package, TruckIcon, TrendingUp, FileText, CheckCircle } from "lucide-react";
import { MetricCardWithChart } from "./MetricCardWithChart";
import { MiniAreaChart } from "./MiniAreaChart";
import { MiniBarChart } from "./MiniBarChart";
import { DonutChart } from "./DonutChart";
import { formatCurrency } from "@/lib/format";

interface SalesSectionProps {
  deliveredSales: {
    count: number;
    value: number;
    trend: { value: number; name: string }[];
  };
  activeSales: {
    count: number;
    value: number;
  };
  conversionRate: number;
  openProposals: {
    count: number;
    value: number;
    byStatus: { name: string; value: number }[];
  };
  acceptedProposals: {
    count: number;
    value: number;
    trend: { value: number; name: string }[];
  };
}

export function SalesSection({
  deliveredSales,
  activeSales,
  conversionRate,
  openProposals,
  acceptedProposals,
}: SalesSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        Vendas
      </h2>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <MetricCardWithChart
          title="Entregues"
          value={formatCurrency(deliveredSales.value)}
          subtitle={`${deliveredSales.count} venda(s)`}
          icon={<CheckCircle className="h-4 w-4" />}
          chart={
            <MiniAreaChart 
              data={deliveredSales.trend} 
              color="hsl(var(--success))"
            />
          }
        />
        
        <MetricCardWithChart
          title="Entrega Ativa"
          value={activeSales.count.toString()}
          subtitle={formatCurrency(activeSales.value)}
          icon={<TruckIcon className="h-4 w-4" />}
          chart={
            <div className="h-[60px] flex items-end">
              <div 
                className="w-full bg-warning/20 rounded-md relative overflow-hidden"
                style={{ height: '24px' }}
              >
                <div 
                  className="absolute inset-y-0 left-0 bg-warning rounded-md transition-all"
                  style={{ width: `${Math.min((activeSales.count / Math.max(activeSales.count + deliveredSales.count, 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          }
        />
        
        <MetricCardWithChart
          title="Taxa de Conversão"
          value={`${conversionRate}%`}
          subtitle="Leads → Vendas"
          icon={<TrendingUp className="h-4 w-4" />}
          chart={
            <div className="flex justify-center">
              <DonutChart 
                value={conversionRate} 
                color="hsl(var(--success))"
              />
            </div>
          }
        />
        
        <MetricCardWithChart
          title="Propostas em Aberto"
          value={formatCurrency(openProposals.value)}
          subtitle={`${openProposals.count} proposta(s)`}
          icon={<FileText className="h-4 w-4" />}
          chart={
            <MiniBarChart 
              data={openProposals.byStatus} 
              color="hsl(var(--warning))"
              showLabels
              height={70}
            />
          }
        />
        
        <MetricCardWithChart
          title="Propostas Aceites"
          value={formatCurrency(acceptedProposals.value)}
          subtitle={`${acceptedProposals.count} proposta(s)`}
          icon={<CheckCircle className="h-4 w-4" />}
          chart={
            <MiniAreaChart 
              data={acceptedProposals.trend} 
              color="hsl(var(--primary))"
            />
          }
        />
      </div>
    </section>
  );
}
