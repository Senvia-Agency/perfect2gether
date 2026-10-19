import { LegacyRhWorkspace } from './LegacyRhWorkspace';
import { useReleaseFeatures } from '@/hooks/useReleaseFeatures';
import { PontoWorkspace } from "@/modules/timeclock/components/PontoWorkspace";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { RhBackendUnavailableError } from "@/lib/rh/load";
import { Helmet } from "react-helmet-async";
import { Clock3, UsersRound, CalendarDays, CalendarClock, Headphones, Megaphone } from "lucide-react";
import "@/components/layout/workspace-theme.css";
import "@/components/rh/rh.css";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { Absences } from "@/components/rh/Absences";
import { CalendarBalances } from "@/components/rh/CalendarBalances";
import { Employees } from "@/components/rh/Employees";
import { Support } from "@/components/rh/Support";
import { Communication } from "@/components/rh/Communication";
const sections = [
  { id: "ponto", label: "Ponto", compact: "Ponto", icon: Clock3, color: "from-violet-400 to-indigo-500" },
  { id: "absences", label: "Ausências", compact: "Ausências", icon: CalendarDays, color: "from-violet-400 to-indigo-500" },
  { id: "calendar", label: "Calendário e saldos", compact: "Calendário", icon: CalendarClock, color: "from-sky-400 to-blue-500" },
  { id: "employees", label: "Colaboradores", compact: "Pessoas", icon: UsersRound, color: "from-emerald-400 to-teal-500" },
  { id: "support", label: "Suporte interno", compact: "Suporte", icon: Headphones, color: "from-orange-300 to-orange-500" },
  { id: "communication", label: "Avisos", compact: "Avisos", icon: Megaphone, color: "from-fuchsia-400 to-purple-500" },
] as const;

export function RhWorkspace() {
  const workspace = useRhWorkspace();
  const { features } = useReleaseFeatures();
  const visibleSections = sections.filter(section => section.id !== "ponto" || features.timeclock);
  const [search, setSearch] = useSearchParams();
  const [fallbackTab, setFallbackTab] = useState("absences");
  const requestedTab = search.get("tab") ?? fallbackTab;
  const tab = requestedTab === "ponto" && !features.timeclock ? "absences" : requestedTab;
  function setTab(value: string) { setFallbackTab(value); setSearch({ tab: value }, { replace: true }); }
  if (!features.new_ui) return <LegacyRhWorkspace />;
  if (tab === "ponto") return <div className="workspace-theme rh-theme rh-workspace p-3 sm:p-6"><Helmet><title>Ponto | Perfect2Gether</title></Helmet><section className="rh-shell"><header className="rh-workspace-header"><div><h1 className="text-xl font-semibold">Recursos Humanos</h1><p className="mt-1 text-sm text-muted-foreground">O seu ponto e a gestão da equipa</p></div></header><Tabs value={tab} onValueChange={setTab}><TabsList className="rh-sections" aria-label="Secções de Recursos Humanos">{visibleSections.map(({id,label,icon:Icon,color}) => <TabsTrigger key={id} value={id} className="rh-section-tab"><span className={"rh-category-icon bg-gradient-to-br " + color}><Icon className="h-5 w-5" /></span>{label}</TabsTrigger>)}</TabsList><div className="rh-content"><PontoWorkspace /></div></Tabs></section></div>;
  if (workspace.isLoading)
    return (
      <div role="status" className="p-4 sm:p-6 lg:p-8 text-muted-foreground">
        A carregar Recursos Humanos…
      </div>
    );
  if (workspace.error instanceof RhBackendUnavailableError)
    return (
      <div role="alert" className="p-4 sm:p-6 lg:p-8 space-y-4">
        <h1 className="text-xl font-semibold">RH indisponível neste ambiente</h1>
        <p>A configuração do serviço de Recursos Humanos ainda não está concluída.</p>
        <Button onClick={() => void workspace.refetch()}>Verificar novamente</Button>
        <a href="/dashboard" className="block text-primary underline">Voltar ao painel</a>
      </div>
    );
  if (workspace.error)
    return (
      <div role="alert" className="p-4 sm:p-6 lg:p-8 space-y-4">
        <p>Não foi possível carregar RH: {workspace.error.message}</p>
        <p className="text-sm text-muted-foreground">
          Contacte o administrador se o problema persistir.
        </p>
        <Button onClick={() => void workspace.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const data = workspace.data;
  if (!data) return null;
  return (
    <div className="workspace-theme rh-theme rh-workspace p-3 sm:p-6">
      <Helmet>
        <title>Recursos Humanos | Perfect2Gether</title>
      </Helmet>
      <section className="rh-shell" aria-label="Recursos Humanos">
      <header className="rh-workspace-header">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rh-workspace-mark"><UsersRound className="h-5 w-5" aria-hidden="true" /></span>
          <div><h1 className="text-lg font-semibold tracking-tight sm:text-xl">Recursos Humanos</h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Ausências, pessoas e apoio à equipa</p></div>
        </div>
        <span className="rh-scope">{workspace.isAdmin ? "Gestão da equipa" : "O meu espaço"}</span>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rh-sections" aria-label="Secções de Recursos Humanos">
          {visibleSections.map(({id, label, compact, icon: Icon, color}) => <TabsTrigger key={id} value={id} aria-label={id === "employees" && !workspace.isAdmin ? "Os meus dados" : label} className="rh-section-tab">
            <span className={"rh-category-icon bg-gradient-to-br " + color}><Icon aria-hidden="true" className="h-5 w-5" /></span>
            <span className="rh-tab-label-long">{id === "employees" && !workspace.isAdmin ? "Os meus dados" : label}</span><span className="rh-tab-label-short" aria-hidden="true">{id === "employees" && !workspace.isAdmin ? "Meus dados" : compact}</span>
          </TabsTrigger>)}
        </TabsList>
        <div className="rh-content">
        <TabsContent value="absences">
          <Absences data={data} workspace={workspace} />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarBalances data={data} workspace={workspace} />
        </TabsContent>
        <TabsContent value="employees">
          <Employees data={data} workspace={workspace} />
        </TabsContent>
        <TabsContent value="support">
          <Support data={data} workspace={workspace} />
        </TabsContent>
        <TabsContent value="communication">
          <Communication data={data} workspace={workspace} />
        </TabsContent>
        </div>
      </Tabs>
      </section>
    </div>
  );
}
