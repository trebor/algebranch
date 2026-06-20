const CACHE_NAME = 'algebranch-cache-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/logo-transparent.png',
  '/logo-textless.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and exclude internal Next.js hot-reloading or API routes
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Detect navigation/document requests (HTML pages)
  const isNavigation = event.request.mode === 'navigate' || 
                       (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, clone it and save to cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If navigation request fails and isn't cached, fallback to the root HTML page '/'
          if (isNavigation) {
            return caches.match('/');
          }
        });
      })
  );
});
