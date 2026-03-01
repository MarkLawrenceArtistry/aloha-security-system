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
    '/resources/logo.png'
    // REMOVED: '/manifest.json' <-- Delete this line!
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

    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // EXTERNAL CDNs (Bootstrap Icons, Fonts): Cache First
    if (url.origin !== self.location.origin) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            }).catch(() => {})
        );
        return;
    }

    // INTERNAL FILES & API: Network First -> Cache Fallback
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If it's a good response, cache it for offline use
                if (networkResponse && networkResponse.status === 200) {
                    const cacheToUse = url.pathname.includes('/api/') ? DATA_CACHE_NAME : CACHE_NAME;
                    const responseClone = networkResponse.clone();
                    caches.open(cacheToUse).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            })
            .catch(async () => {
                // Network failed (Offline) - fallback to Cache
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) return cachedResponse;
            })
    );
});