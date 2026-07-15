const CACHE_NAME = 'daily-movie-v2';

const PRECACHE_URLS = [
  '/',
  '/styles/v2-theme.css',
  '/fonts/CormorantGaramond-Regular.woff2',
  '/fonts/CormorantGaramond-Italic.woff2',
  '/fonts/NotoSerifSC-Regular.subset.woff2',
  '/logo.png',
  '/favicon.png',
  '/favicon.svg',
  '/fallback-poster.svg',
  '/manifest.webmanifest',
];

// Install: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: stale-while-revalidate for images, cache-first for static
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Image requests: stale-while-revalidate
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const promise = fetch(request).then((response) => {
          cache.put(request, response.clone());
          return response;
        });
        return cached || promise;
      })
    );
    return;
  }

  // Default: network-first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});