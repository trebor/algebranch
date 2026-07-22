// SW_VERSION and PRECACHE_NAME are stamped with the release version (#451): the
// `prebuild` step (scripts/stamp-sw.mjs) rewrites them from root package.json, and
// release-please keeps the committed values in sync via the x-release-please-version
// annotations below. Do not hand-edit the versions.
const PRECACHE_NAME = 'algebranch-precache-v1.5.0'; // x-release-please-version
const STATIC_CACHE_NAME = 'algebranch-static-v1';
const RUNTIME_CACHE_NAME = 'algebranch-runtime-v1';
const CURRENT_CACHES = [PRECACHE_NAME, STATIC_CACHE_NAME, RUNTIME_CACHE_NAME];

const SW_VERSION = '1.5.0'; // x-release-please-version

const MAX_STATIC_ENTRIES = 150;
const MAX_RUNTIME_ENTRIES = 50;

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

// Helper to trim cache size
const trimCache = (cacheName, maxItems) => {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        const excess = keys.length - maxItems;
        for (let i = 0; i < excess; i++) {
          cache.delete(keys[i]);
        }
      }
    });
  });
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Do NOT call self.skipWaiting() here. Wait for SKIP_WAITING message.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!CURRENT_CACHES.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests and exclude API routes
  if (event.request.method !== 'GET' || url.pathname.includes('/api/')) {
    return;
  }

  // Detect navigation/document requests (HTML pages)
  const isNavigation = event.request.mode === 'navigate' ||
                       (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  // 0. Network-first for the app shell (navigations / `/`). Serving HTML
  //    cache-first pinned returning visitors to a stale build until sw.js itself
  //    changed; go to the network first so online users always get the current
  //    HTML, and fall back to the precached page — its own URL first, then the
  //    `/` app shell — only when offline.
  if (isNavigation || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            // Cache each page under its OWN URL; only `/` is the app shell.
            // Caching every navigation under `/` poisoned the shell — a hard
            // load of a distinct route (e.g. /user-guide, #514) would overwrite
            // it, so an offline `/` launch showed that other page.
            const cacheKey = url.pathname === '/' ? '/' : event.request;
            caches.open(PRECACHE_NAME).then((cache) => cache.put(cacheKey, responseToCache));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request, { cacheName: PRECACHE_NAME })
            .then((cached) => cached || caches.match('/', { cacheName: PRECACHE_NAME }))
        )
    );
    return;
  }

  // 1. Cache-first for precached core assets
  const isPrecached = ASSETS_TO_CACHE.includes(url.pathname);
  if (isPrecached) {
    event.respondWith(
      caches.match(event.request, { cacheName: PRECACHE_NAME }).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(PRECACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 2. Cache-first for same-origin static assets (chunks)
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).then(() => {
                trimCache(STATIC_CACHE_NAME, MAX_STATIC_ENTRIES);
              });
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Network-first for other same-origin runtime assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).then(() => {
                trimCache(RUNTIME_CACHE_NAME, MAX_RUNTIME_ENTRIES);
              });
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (isNavigation) {
              return caches.match('/', { cacheName: PRECACHE_NAME });
            }
          });
        })
    );
    return;
  }
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: SW_VERSION });
    }
  }
});
