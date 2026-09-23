// Bump this whenever index.html/manifest/icons change, so old cached copies get replaced.
const CACHE_NAME = 'fund-ledger-v4';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Page loads: network first, cached shell as offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy);
          });

          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (cached) => cached || caches.match('./index.html')
          )
        )
    );

    return;
  }

  // IMPORTANT:
  // Never cache the live NAV/search API.
  // Always request fresh data from Tigzig.
  const isTigzigApi = req.url.startsWith(
    'https://api.tigzig.com/'
  );

  if (isTigzigApi) {
    event.respondWith(
      fetch(req, {
        cache: 'no-store'
      })
    );

    return;
  }

  // Everything else: cache-first for offline support.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, copy);
            });
          }

          return res;
        })
        .catch(() => cached);
    })
  );
});
