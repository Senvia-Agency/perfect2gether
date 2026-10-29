import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isEdpUiAvailable } from "../environment";
import { useEdpSettings } from "../useEdp";
import { EdpSettingsPanel } from "./EdpSettingsPanel";

export function EdpSettingsCard() {
  const uiAvailable = isEdpUiAvailable();
  const { settingsQuery, saveSettings } = useEdpSettings(uiAvailable);
  if (!uiAvailable) return null;

  if (settingsQuery.isLoading) {
    return <div className="flex min-h-32 items-center justify-center rounded-lg border"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (settingsQuery.error || !settingsQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Não foi possível carregar a configuração EDP</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{settingsQuery.error instanceof Error ? settingsQuery.error.message : "Resposta EDP indisponível."}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void settingsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return <EdpSettingsPanel value={settingsQuery.data} onSave={saveSettings} />;
}
