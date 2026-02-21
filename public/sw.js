// public/sw.js
const CACHE_NAME = 'aloha-cache-v2'; // Changed to v2 to force the browser to update

// Added Admin files to the cache
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/application.html',
    '/status-result.html',
    '/login.html',
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

// 1. Install Event: Save files to cache when user first visits
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Forces the new service worker to activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching Files');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Fetch Event: Intercept network requests
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                return response;
            })
            .catch(() => {
                // IF NETWORK FAILS (OFFLINE), PULL FROM THE CACHE!
                return caches.match(event.request);
            })
    );
});