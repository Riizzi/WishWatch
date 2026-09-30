/// <reference lib="webworker" />
/**
 * Service worker do WishWatch: cache do app (offline) e notificações push.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Navegações caem no index.html do cache (SPA offline), exceto /api e /.well-known.
// Em desenvolvimento o index.html não é pré-cacheado, então a rota fica de fora.
if (import.meta.env.PROD) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      denylist: [/^\/api\//, /^\/\.well-known\//],
    })
  );
}

interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'WishWatch', {
      body: data.body || '',
      tag: data.tag,
      icon: '/notification-icon.png',
      badge: '/pwa-monochrome-512x512.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data?.url as string) || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          client.postMessage({ type: 'open-url', url: target });
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
