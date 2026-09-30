/**
 * ============================================================================
 * SERVICE WORKER AISLADO CON PURGA ATÓMICA: QuestFest PWA
 * ============================================================================
 * Implementa políticas segregadas por nivel de criticidad:
 * - Network-Only: Endpoints financieros, transaccionales, auth y administración.
 * - Stale-While-Revalidate: Catálogos públicos y reglas con TTL corto.
 * - Cache-First: Recursos estáticos inmutables y assets CDN.
 * - Purga Atómica (CLEAR_APP_CACHE): Destruye la caché al cerrar sesión
 *   para garantizar soberanía contable y privacidad en dispositivos compartidos.
 * ============================================================================
 */

const CACHE_NAME = 'questfest-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon.png',
  '/icons/apple-touch-icon.png',
];

// Instalación del Service Worker y precache del app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching app shell y página offline');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación y limpieza determinista de cachés obsoletas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Intercepción y enrutamiento granular de peticiones de red
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignorar esquemas no HTTP/HTTPS (extensiones, etc.) y métodos mutables (POST/PUT/PATCH/DELETE)
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 2. POLÍTICA NETWORK-ONLY: Endpoints financieros, contables, auth y panel de administración
  // Jamás deben ser cacheados para impedir desincronizaciones del Ledger de QuestCoins o fugas de sesión
  const isNetworkOnlyApi =
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/api/admin/') ||
    url.pathname.startsWith('/api/notifications/') ||
    url.pathname.startsWith('/api/groups/') ||
    url.pathname.startsWith('/api/apuestas/') ||
    url.pathname.startsWith('/api/duelos/') ||
    url.pathname.startsWith('/api/misiones/') ||
    url.pathname.startsWith('/api/ruleta/') ||
    url.pathname.startsWith('/api/upload/') ||
    url.pathname.includes('/transactions');

  if (isNetworkOnlyApi) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Peticiones de navegación (HTML): Network-First con Fallback a /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/offline');
          });
        })
    );
    return;
  }

  // 4. POLÍTICA STALE-WHILE-REVALIDATE: Catálogos públicos y reglas estables
  if (
    url.pathname.startsWith('/api/settings/rules') ||
    url.pathname.startsWith('/api/ranking/')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 5. POLÍTICA CACHE-FIRST: Recursos estáticos e inmutables (_next/static, fuentes, iconos, Cloudinary)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname.includes('cloudinary.com') ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 ||
              networkResponse.type === 'opaque')
          ) {
            const responseToCache = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 6. Estrategia por defecto para el resto de peticiones: Red directa con fallback a caché
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

// Manejador de eventos 'message': Soporta forzar actualización y purga atómica de sesión
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  // Purga atómica de la caché al cerrar sesión
  if (
    event.data &&
    (event.data.type === 'CLEAR_APP_CACHE' ||
      event.data.action === 'CLEAR_APP_CACHE')
  ) {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[Service Worker] Caché de aplicación purgada por logout');
      })
    );
  }
});

// Manejo de notificaciones Push (VAPID)
self.addEventListener('push', (event) => {
  let data = {
    title: 'QuestFest',
    body: 'Tienes una nueva notificación en QuestFest',
  };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.url || '/',
    vibrate: [100, 50, 100],
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
