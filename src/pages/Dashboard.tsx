import { useAuth } from "@/contexts/AuthContext";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { DynamicWidget } from "@/components/dashboard/DynamicWidget";
import { TeamMemberFilter } from "@/components/dashboard/TeamMemberFilter";
import { DashboardPeriodFilter } from "@/components/dashboard/DashboardPeriodFilter";
import { FidelizationAlertsWidget } from "@/components/dashboard/FidelizationAlertsWidget";
import { CalendarAlertsWidget } from "@/components/dashboard/CalendarAlertsWidget";
import { CommitmentPanel } from "@/components/dashboard/CommitmentPanel";
import { SalesPerformancePanel } from "@/components/dashboard/SalesPerformancePanel";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { CommissionsWidget } from "@/components/dashboard/CommissionsWidget";
import { TeamPerformanceTable } from "@/components/dashboard/TeamPerformanceTable";
import { Loader2 } from "lucide-react";
import { NicheType } from "@/lib/dashboard-templates";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useModules } from "@/hooks/useModules";
import { ActivationsPanel } from "@/components/dashboard/ActivationsPanel";

export default function Dashboard() {
  useRealtimeSubscription([
    { table: 'leads', queryKeys: [['leads'], ['dashboard-stats']] },
    { table: 'proposals', queryKeys: [['proposals'], ['dashboard-stats']] },
    { table: 'sales', queryKeys: [['sales'], ['dashboard-stats']] },
  ]);
  const { profile, organization } = useAuth();
  const { modules } = useModules();
  const isTelecom = organization?.niche === 'telecom';
  const clientsModuleEnabled = modules.clients;
  const calendarModuleEnabled = modules.calendar !== false;
  const salesSettings = (organization?.sales_settings as any) || {};
  const commissionsEnabled = !!salesSettings.commissions_enabled;
  const { 
    visibleWidgets, 
    isLoading, 
    niche, 
  } = useDashboardWidgets();

  const greeting = profile?.full_name 
    ? `Olá, ${profile.full_name.split(' ')[0]}` 
    : 'Olá';

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{greeting}</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Bem-vindo ao painel de controlo da {organization?.name || 'sua organização'}.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <DashboardPeriodFilter />
          <TeamMemberFilter className="w-[160px] sm:w-[180px]" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {isTelecom && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Atividade Comercial</h2>
              <div className="space-y-4">
                <CommitmentPanel />
                <SalesPerformancePanel />
                <MetricsPanel />
                <ActivationsPanel />
              </div>
            </div>
          )}

          {(isTelecom && clientsModuleEnabled || calendarModuleEnabled) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {isTelecom && clientsModuleEnabled && (
                <FidelizationAlertsWidget />
              )}
              {calendarModuleEnabled && (
                <CalendarAlertsWidget />
              )}
            </div>
          )}

          {commissionsEnabled && (
            <CommissionsWidget />
          )}

          {visibleWidgets.some(w => w.widget_type === 'team_performance_table') && (
            <TeamPerformanceTable />
          )}
          
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleWidgets.filter(w => w.widget_type !== 'team_performance_table').map((widget) => (
              <DynamicWidget
                key={widget.id || widget.widget_type}
                widgetType={widget.widget_type as any}
                niche={niche as NicheType}
              />
            ))}
          </div>
        </div>
      )}

      {visibleWidgets.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            Nenhum widget configurado para o seu perfil. Contacte o administrador para personalizar o dashboard em Definições &gt; Perfis.
          </p>
        </div>
      )}
    </div>
  );
}
