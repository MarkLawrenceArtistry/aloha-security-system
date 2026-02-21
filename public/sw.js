const CACHE_NAME = 'aloha-static-v4'; // Increment version
const DATA_CACHE_NAME = 'aloha-data-v2';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/login.html',
    '/admin-dashboard.html',
    '/applicants.html',
    '/branches.html',
    '/deployment.html',
    '/roster.html',
    '/users.html',
    '/settings.html',
    '/audit-log.html',
    '/css/style.css',
    '/css/admin.css',
    '/css/login.css',
    '/js/admin.js',
    '/resources/logo.png',
    '/manifest.json' // If you have one
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // 1. API DATA: Network First -> Cache Fallback (Stale-While-Revalidate logic)
    if (url.pathname.includes('/api/')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then(async (cache) => {
                try {
                    const networkResponse = await fetch(event.request);
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                } catch (error) {
                    const cachedResponse = await cache.match(event.request);
                    if (cachedResponse) return cachedResponse;
                    throw error;
                }
            })
        );
        return;
    }

    // 2. EXTERNAL CDNs (Bootstrap Icons, Fonts): Cache First
    if (url.origin !== self.location.origin) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) return response;
                return fetch(event.request).then((networkResponse) => {
                    // Cache the new external resource
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => {
                    // If offline and not in cache, we can't do anything for external CDN
                });
            })
        );
        return;
    }

    // 3. STATIC FILES: Cache First -> Network
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        }).catch(() => {
             // Optional: Return custom offline page here
        })
    );
});