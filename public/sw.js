// public/sw.js
const CACHE_NAME = 'aloha-cache-v1';

// These are the files that will be saved to the user's hard drive
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/application.html',
    '/status-result.html',
    '/css/style.css',
    '/css/application.css',
    '/js/main.js',
    '/resources/logo.png'
];

// 1. Install Event: Save files to cache when user first visits
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching Files');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Fetch Event: Intercept network requests (The "Messenger" Magic)
self.addEventListener('fetch', (event) => {
    // Only intercept GET requests (we don't cache form submissions like POST)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        // TRY THE NETWORK FIRST...
        fetch(event.request)
            .then(response => {
                // If the network works, return the fresh page
                return response;
            })
            .catch(() => {
                // IF NETWORK FAILS (OFFLINE), PULL FROM THE CACHE!
                return caches.match(event.request);
            })
    );
});