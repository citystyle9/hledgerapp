const CACHE_NAME = 'homeledger-v1.4.9'; 
const REQUIRED_FILES = [
    '/',
    'index.html',
    // manifest.json is required for PWA installation prompt
    'manifest.json', 
];

// 1. Installation: Cache the required files
self.addEventListener('install', (event) => {
    // Force the new service worker to take over immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all required assets.');
                return cache.addAll(REQUIRED_FILES);
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// 2. Activation: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Claim control of clients to ensure new pages use the new Service Worker immediately
    event.waitUntil(self.clients.claim());
});

// 3. Fetching: Serve cached content first, then fall back to network.
self.addEventListener('fetch', (event) => {
    // Only process GET requests (safe for APIs and assets)
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Skip the Google Sheets API URL from caching (Always fetch fresh data)
    // IMPORTANT: This ensures your data is never served from an old cache version
    if (url.origin === 'https://script.google.com') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Strategy: Cache-First for all other requests (our static assets)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // If a match is found in the cache, return it (Cache-First)
                return cachedResponse;
            }
            // If no match is found, fetch from the network
            return fetch(event.request).catch((error) => {
                console.error('Fetch failed:', error);
                // In a real PWA, you might return a generic offline page here.
            });
        })
    );
});
