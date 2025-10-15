const CACHE_NAME = 'homeledger-cache-v1-4-9-sheets-v1';
const urlsToCache = [
  // Core files to be cached for offline use
  './', // Caches index.html implicitly
  './index.html',
  './app.html', // The main application code
  './sw.js', 
];

// 1. Installation: Cache the core assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Activation: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetching: Strategy for App files (Cache First) and API (Network First)
self.addEventListener('fetch', event => {
  // Strategy for Google Sheets API: Network First with a simulated offline response
  if (event.request.url.includes('script.google.com/macros/s/')) {
    event.respondWith(fetch(event.request)
        .catch(() => {
            // This is the fallback when network is unavailable.
            console.log('[Service Worker] Sheets API request failed (Offline or Error).');
            
            // Return a 503 response so the app's JS can handle the failure gracefully
            return new Response(JSON.stringify({ 
                result: 'error', 
                message: 'Offline access: Failed to reach Google Sheets API.' 
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        })
    );
    return;
  }
  
  // Strategy for App Files (HTML, JS, CSS): Cache First
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        // Serve the file from the cache
        return response;
      }
      // If not in cache, fetch from network
      return fetch(event.request);
    })
  );
});
