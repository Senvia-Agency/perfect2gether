import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useFidelizationSettings, useUpdateFidelizationSettings } from '@/hooks/useFidelizationAlerts';
import { toast } from 'sonner';
import { Bell, Calendar, Loader2, Zap } from 'lucide-react';

export function FidelizationAlertsSettings() {
  const { data: settings, isLoading } = useFidelizationSettings();
  const updateSettings = useUpdateFidelizationSettings();

  const [firstAlertDays, setFirstAlertDays] = useState(30);
  const [secondAlertDays, setSecondAlertDays] = useState(7);
  const [createEvent, setCreateEvent] = useState(true);
  const [eventTime, setEventTime] = useState('10:00');

  useEffect(() => {
    if (settings) {
      const days = settings.fidelization_alert_days;
      setFirstAlertDays(days[0] || 30);
      setSecondAlertDays(days[1] || 7);
      setCreateEvent(settings.fidelization_create_event);
      setEventTime(settings.fidelization_event_time?.slice(0, 5) || '10:00');
    }
  }, [settings]);

  const handleSave = () => {
    if (firstAlertDays <= secondAlertDays) {
      toast.error('O primeiro alerta deve ser mais dias antes que o segundo');
      return;
    }

    updateSettings.mutate({
      fidelization_alert_days: [firstAlertDays, secondAlertDays],
      fidelization_create_event: createEvent,
      fidelization_event_time: eventTime,
    }, {
      onSuccess: () => {
        toast.success('Definições de alertas guardadas');
      },
      onError: () => {
        toast.error('Erro ao guardar definições');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Alertas de Fidelização
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure alertas automáticos quando contratos CPE/CUI estão prestes a expirar.
        </p>
      </div>

      {/* Alert Days Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Dias de Antecedência
          </CardTitle>
          <CardDescription>
            Defina quando deve ser notificado antes da expiração.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first-alert">Primeiro alerta</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="first-alert"
                  type="number"
                  min={1}
                  max={90}
                  value={firstAlertDays}
                  onChange={(e) => setFirstAlertDays(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="second-alert">Segundo alerta (urgente)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="second-alert"
                  type="number"
                  min={1}
                  max={30}
                  value={secondAlertDays}
                  onChange={(e) => setSecondAlertDays(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Event Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Evento de Calendário
          </CardTitle>
          <CardDescription>
            Crie automaticamente eventos de "Visita de Renovação".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Criar evento automático</Label>
              <p className="text-xs text-muted-foreground">
                Adicionar ao calendário quando o alerta é enviado
              </p>
            </div>
            <Switch
              checked={createEvent}
              onCheckedChange={setCreateEvent}
            />
          </div>
          
          {createEvent && (
            <div className="space-y-2">
              <Label htmlFor="event-time">Hora sugerida para visita</Label>
              <Input
                id="event-time"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="w-32"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button 
        onClick={handleSave} 
        disabled={updateSettings.isPending}
        className="w-full sm:w-auto"
      >
        {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Guardar Definições
      </Button>
    </div>
  );
}
