const CACHE_NAME = 'sana-shell-v3';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first for the app shell (HTML/manifest) so a fresh deploy shows up
// immediately instead of one load behind — cache is only a fallback for when
// the network is unavailable, not the primary source of truth during active
// development.
const NETWORK_FIRST = ['/', '/index.html', '/manifest.json'];

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNetworkFirst = url.origin === self.location.origin && NETWORK_FIRST.includes(url.pathname);

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate for everything else (icons, fonts, etc.) — staleness
  // there is harmless and instant-from-cache is worth it.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
