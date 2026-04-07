import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface PushNotificationsCardProps {
  organizationId?: string;
  pushNotifications: {
    isSupported: boolean;
    isSubscribed: boolean;
    isLoading: boolean;
    subscribe: () => Promise<boolean>;
    unsubscribe: () => Promise<boolean>;
  };
}

export const PushNotificationsCard = ({ organizationId, pushNotifications }: PushNotificationsCardProps) => {
  const { toast } = useToast();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba alertas instantâneos quando chegarem novos leads.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pushNotifications.isSupported ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              O seu browser não suporta notificações push. Tente usar Chrome, Safari ou Firefox.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {pushNotifications.isSubscribed ? 'Notificações ativas' : 'Notificações desativadas'}
              </p>
              <p className="text-xs text-muted-foreground">
                {pushNotifications.isSubscribed 
                  ? 'Vai receber alertas para novos leads.' 
                  : 'Ative para receber alertas instantâneos.'}
              </p>
            </div>
            <div className="flex gap-2">
              {pushNotifications.isSubscribed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!organizationId) return;
                    try {
                      const { error } = await supabase.functions.invoke('send-push-notification', {
                        body: {
                          organization_id: organizationId,
                          title: '🔔 Teste de Notificação',
                          body: 'Se vês isto, as notificações estão a funcionar!',
                          url: '/settings',
                          tag: 'test-notification',
                        },
                      });
                      if (error) throw error;
                      toast({ title: 'Teste enviado!', description: 'Aguarda a notificação no dispositivo.' });
                    } catch (err) {
                      toast({ title: 'Erro', description: 'Não foi possível enviar o teste.', variant: 'destructive' });
                    }
                  }}
                >
                  Testar
                </Button>
              )}
              <Button
                variant={pushNotifications.isSubscribed ? "outline" : "default"}
                size="sm"
                onClick={pushNotifications.isSubscribed ? pushNotifications.unsubscribe : pushNotifications.subscribe}
                disabled={pushNotifications.isLoading}
              >
                {pushNotifications.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : pushNotifications.isSubscribed ? (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Desativar
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Ativar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
