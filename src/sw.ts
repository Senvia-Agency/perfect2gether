/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Service Worker Version (increment to force update)
const SW_VERSION = '1.2.1';
console.log(`[SW] Perfect2Gether Service Worker v${SW_VERSION} loaded`);

// Precache assets from Vite build
precacheAndRoute(self.__WB_MANIFEST);

// Activate immediately on install
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(self.skipWaiting());
});

// Take control immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// Push notification handler with improved iOS support
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  let data: { title?: string; body?: string; tag?: string; url?: string } = {};
  
  try {
    data = event.data?.json() ?? {};
    console.log('[SW] Push data:', JSON.stringify(data));
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    data = { title: 'Perfect2Gether', body: event.data?.text() || 'Nova notificação' };
  }

  const options: NotificationOptions = {
    body: data.body || 'Nova atualização disponível',
    icon: '/logo-p2gether.png',
    badge: '/logo-p2gether.png',
    tag: data.tag || 'p2g-notification',
    data: { url: data.url || '/leads' },
    requireInteraction: true,
    silent: false,
  };

  console.log('[SW] Showing notification:', data.title, options);

  event.waitUntil(
    self.registration.showNotification(data.title || 'Perfect2Gether', options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((err) => console.error('[SW] Error showing notification:', err))
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/leads';
  console.log('[SW] Opening URL:', urlToOpen);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            (client as WindowClient).navigate(urlToOpen);
          }
          return;
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});
