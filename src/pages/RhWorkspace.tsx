import { useState } from "react";
import { RhBackendUnavailableError } from "@/lib/rh/load";
import { Helmet } from "react-helmet-async";
import { UsersRound } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { Absences } from "@/components/rh/Absences";
import { CalendarBalances } from "@/components/rh/CalendarBalances";
import { Employees } from "@/components/rh/Employees";
import { Support } from "@/components/rh/Support";
import { Communication } from "@/components/rh/Communication";
export function RhWorkspace() {
  const workspace = useRhWorkspace();
  const [tab, setTab] = useState("absences");
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <Helmet>
        <title>Recursos Humanos | Perfect2Gether</title>
      </Helmet>
      <header className="flex items-center gap-3">
        <UsersRound className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Recursos Humanos</h1>
          <p className="text-sm text-muted-foreground">
            Ausências, colaboradores e apoio à equipa
          </p>
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="absences">Ausências</TabsTrigger>
          <TabsTrigger value="calendar">Calendário e saldos</TabsTrigger>
          <TabsTrigger value="employees">{workspace.isAdmin ? "Colaboradores" : "Os meus dados"}</TabsTrigger>
          <TabsTrigger value="support">Suporte interno</TabsTrigger>
          <TabsTrigger value="communication">
            Avisos
          </TabsTrigger>
        </TabsList>
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
      </Tabs>
    </div>
  );
}
