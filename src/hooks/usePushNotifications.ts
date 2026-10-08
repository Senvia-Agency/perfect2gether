import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { VAPID_PUBLIC_KEY } from "@/lib/push-key";
import { ensurePushSubscription, subscriptionUsesKey } from "@/lib/push-subscription";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { user, organization } = useAuth();
  const { toast } = useToast();

  // Check support and current subscription status
  useEffect(() => {
    const checkSupport = async () => {
      setIsSubscribed(false);
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
      
      setIsSupported(supported);
      if (supported) setPermission(Notification.permission);

      if (!supported || !user || !organization) {
        setIsLoading(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          // Check if subscription exists in database
          const { data, error } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('organization_id', organization.id)
            .eq('endpoint', subscription.endpoint)
            .maybeSingle();
          
          if (!error && data && Notification.permission === 'granted' && !subscriptionUsesKey(subscription, VAPID_PUBLIC_KEY)) {
            const renewed = await ensurePushSubscription(registration.pushManager, VAPID_PUBLIC_KEY);
            await saveSubscription(renewed, user.id, organization.id);
            if (renewed.endpoint !== subscription.endpoint) await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('organization_id', organization.id).eq('endpoint', subscription.endpoint);
            setIsSubscribed(true);
          } else setIsSubscribed(!error && !!data && subscriptionUsesKey(subscription, VAPID_PUBLIC_KEY));
        }
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
      
      setIsLoading(false);
    };

    checkSupport();
  }, [user, organization]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user || !organization) {
      toast({
        title: 'Erro',
        description: 'Notificações push não suportadas ou utilizador não autenticado.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Request notification permission
      const permResult = await Notification.requestPermission();
      setPermission(permResult);

      if (permResult !== 'granted') {
        toast({
          title: 'Permissão negada',
          description: 'Precisa de permitir notificações para receber alertas.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      const previous = await registration.pushManager.getSubscription();
      const subscription = await ensurePushSubscription(registration.pushManager, VAPID_PUBLIC_KEY);
      await saveSubscription(subscription, user.id, organization.id);
      if (previous && previous.endpoint !== subscription.endpoint) await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('organization_id', organization.id).eq('endpoint', previous.endpoint);

      setIsSubscribed(true);
      toast({
        title: 'Notificações ativadas',
        description: 'Vai receber alertas quando chegarem novos leads.',
      });

      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao ativar notificações.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, organization, toast]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);

        // Unsubscribe from push manager
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast({
        title: 'Notificações desativadas',
        description: 'Já não vai receber alertas de novos leads.',
      });

      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao desativar notificações.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  const toggle = useCallback(async () => {
    if (isSubscribed) {
      return await unsubscribe();
    } else {
      return await subscribe();
    }
  }, [isSubscribed, subscribe, unsubscribe]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    toggle,
  };
}


async function saveSubscription(subscription: PushSubscription, userId: string, organizationId: string): Promise<void> {
  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');
  if (!p256dh || !auth) throw new Error('Falha ao obter chaves de subscrição');
  const encode = (buffer: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const { error } = await supabase.from('push_subscriptions').upsert({user_id: userId, organization_id: organizationId, endpoint: subscription.endpoint, p256dh: encode(p256dh), auth: encode(auth)}, {onConflict: 'endpoint'});
  if (error) throw new Error('Erro ao guardar subscrição');
}
