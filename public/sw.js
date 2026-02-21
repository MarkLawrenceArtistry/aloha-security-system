const CACHE_NAME = 'aloha-static-v3';
const DATA_CACHE_NAME = 'aloha-data-v1';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/application.html',
    '/status-result.html',
    '/login.html',
    '/audit-log.html',
    '/settings.html',
    '/users.html',
    '/admin-dashboard.html',
    '/applicants.html',
    '/branches.html',
    '/deployment.html',
    '/roster.html',
    '/css/style.css',
    '/css/application.css',
    '/css/admin.css',
    '/css/login.css',
    '/js/main.js',
    '/js/admin.js',
    '/js/applicants.js',
    '/resources/logo.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Cleanup old caches
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
});

self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // 1. API DATA CACHING (Network First, Fallback to Cache)
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clonedResponse = response.clone();
                    caches.open(DATA_CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
                    return response;
                })
                .catch(() => {
                    // IF OFFLINE: Serve the last known database state!
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 2. HTML/CSS/JS CACHING (Network First, Fallback to Cache)
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});