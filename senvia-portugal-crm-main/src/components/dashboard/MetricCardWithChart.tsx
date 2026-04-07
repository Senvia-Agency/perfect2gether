import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardWithChartProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  chart?: React.ReactNode;
  className?: string;
}

export function MetricCardWithChart({
  title,
  value,
  subtitle,
  icon,
  trend,
  chart,
  className,
}: MetricCardWithChartProps) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 flex flex-col justify-between min-h-[160px]",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            {icon}
            <span>{title}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            {trend && (
              <span className={cn(
                "flex items-center text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                )}
                {trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {chart && (
        <div className="mt-3 -mx-1">
          {chart}
        </div>
      )}
    </div>
  );
}
