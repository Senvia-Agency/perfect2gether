import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PortalMetricCard } from "@/components/portal-total-link/PortalMetricCard";
import {
  portalHomeMetrics,
  type MetricView,
} from "@/components/portal-total-link/portalMetricData";

export default function PortalTotalLinkHomePage() {
  const [searchParams] = useSearchParams();
  const [metricViews, setMetricViews] = useState<Record<string, MetricView>>(() =>
    Object.fromEntries(portalHomeMetrics.map((metric) => [metric.title, "global"])) as Record<string, MetricView>,
  );

  const selectedCycle = searchParams.get("homeCycle") ?? "1";
  const selectedYear = searchParams.get("homeYear") ?? String(new Date().getFullYear());

  const globalLabel = useMemo(
    () => `Ciclo ${selectedCycle} / ${selectedYear} - Global`,
    [selectedCycle, selectedYear],
  );

  const teamLabel = useMemo(
    () => `Ciclo ${selectedCycle} / ${selectedYear} - Equipa`,
    [selectedCycle, selectedYear],
  );

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:gap-5">
        {portalHomeMetrics.map((metric) => (
          <PortalMetricCard
            key={metric.title}
            metric={metric}
            currentView={metricViews[metric.title] ?? "global"}
            globalLabel={globalLabel}
            teamLabel={teamLabel}
            teamBreakdown={metric.teamBreakdown}
            onOpenTeamView={() => setMetricViews((current) => ({ ...current, [metric.title]: "team" }))}
            onReturnToGlobal={() => setMetricViews((current) => ({ ...current, [metric.title]: "global" }))}
          />
        ))}
      </div>
    </section>
  );
}
