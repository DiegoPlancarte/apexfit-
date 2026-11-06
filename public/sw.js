/**
 * ApexFit Service Worker (Offline-First Asset Caching & Fallback)
 */

const CACHE_NAME = 'apexfit-cache-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/apexfit-app-icon.png',
  '/apexfit-icon-only.png',
  '/icon-512.png',
  '/apexfit-splash.png',
];

// Install: Cache critical static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Purge obsolete previous caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Offline-first cache strategy with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external API endpoints (e.g. Google Apps Script)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // SPA navigation fallback: serve cached index.html when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('/index.html');
        return cachedIndex || Response.error();
      })
    );
    return;
  }

  // Static assets: cache-first with network fallback and dynamic caching
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is an image, fallback to cached app insignia
          if (request.destination === 'image') {
            return caches.match('/apexfit-icon-only.png');
          }
          return Response.error();
        });
    })
  );
});
