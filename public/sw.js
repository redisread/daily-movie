const CACHE_NAME = 'daily-movie-v1';

const PRECACHE_URLS = [
  '/',
  '/styles/anthropic-theme.css',
  '/logo.png',
  '/favicon.png',
  '/fallback-poster.svg',
  '/manifest.webmanifest',
];

// Install: precache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  (self as any).skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  (self as any).clients.claim();
});

// Fetch: stale-while-revalidate for images, cache-first for static
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

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
      .catch(() => caches.match(request) as Promise<Response>)
  );
});
