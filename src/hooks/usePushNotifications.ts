import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = 'BPheJr4xGbGEdqLeawCOx4bahUlERq9bOvn1dGznjrei6yRo4GfRYCJaj-WD_zVvMHekax5FQYUV-Uw89jyWFhA';

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
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
      
      setIsSupported(supported);
      setPermission(Notification.permission);

      if (!supported || !user) {
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
            .eq('endpoint', subscription.endpoint)
            .maybeSingle();
          
          setIsSubscribed(!error && !!data);
        }
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
      
      setIsLoading(false);
    };

    checkSupport();
  }, [user]);

  // Convert VAPID key from base64 to Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

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

      // Subscribe to push manager
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Extract keys from subscription
      const p256dh = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');

      if (!p256dh || !auth) {
        throw new Error('Falha ao obter chaves de subscrição');
      }

      // Convert ArrayBuffer to base64
      const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      };

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          organization_id: organization.id,
          endpoint: subscription.endpoint,
          p256dh: arrayBufferToBase64(p256dh),
          auth: arrayBufferToBase64(auth),
        }, {
          onConflict: 'endpoint',
        });

      if (error) {
        console.error('Error saving subscription:', error);
        throw new Error('Erro ao guardar subscrição');
      }

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
