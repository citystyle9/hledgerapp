const CACHE_NAME = 'homeledger-v1.5.3';
// Updated to match app version
const basePath = '/hledgerapp/';
const urlsToCache = [
  basePath, // Root URL for Github Pages
  basePath + 'index.html', // Main file
  basePath + 'manifest.json',
  basePath + 'style.css', // New: CSS file
  basePath + 'app.js', // New: Main application script
  basePath + 'data-service.js', // New: Data logic script
  basePath + 'utils.js', // New: Helper functions
  basePath + 'service-worker.js', // New: Cache itself
  basePath + 'offline.html', // New: Offline fallback page
  // Icons must also be cached
  basePath + 'icons/icon-192x192.png',
  basePath + 'icons/icon-512x512.png'
];

// Helper function to handle fallback: returns the response or the offline page response
function fetchAndFallback(event) {
    // 1. Try to fetch from the network (for updates/new content)
    // 2. If network fails, fall back to cache
    return fetch(event.request).catch(async () => {
        // If network failed, check cache for the requested asset
        const cached = await caches.match(event.request);
        
        if (cached) {
            return cached;
        } else {
            // If resource is not in cache, and it's a navigation request, serve the offline page
            if (event.request.mode === 'navigate') {
                return caches.match(basePath + 'offline.html');
            }
            // For non-navigation requests (JS/CSS/images), just fail the request if not found
            // Returning an empty Response prevents the Uncaught TypeError.
            return new Response(null, { status: 503, statusText: 'Service Unavailable (Offline)' });
        }
    });
}

self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching assets.');
        // Add all URLs to the cache (this must succeed for SW to install)
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // To activate the worker immediately
      .catch(err => {
        console.error('[Service Worker] Caching failed:', err);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  // Remove old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Only delete caches that are different from the current CACHE_NAME
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Ensures the worker controls all tabs
  );
});

self.addEventListener('fetch', event => {
  // If the request is a POST (like Google Sheets sync), let it go through network only
  if (event.request.method !== 'GET') {
      return;
  }
  
  // Handling Navigation Requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
        fetch(event.request) // 1. Try Network
        .catch(async () => { // 2. Fallback to Cache
            const indexMatch = await caches.match(basePath + 'index.html');
            return indexMatch || caches.match(basePath + 'offline.html'); // Serve index or offline page
        })
    );
    return;
  }
  
  // Handling Resource Requests (CSS, JS, Images, JSONP)
  event.respondWith(
    caches.match(event.request) // 1. Try Cache
      .then(response => {
        if (response) {
            return response;
        }
        // 2. If not in cache, fetch from network
        return fetch(event.request);
      })
      .catch(error => {
          console.error('Fetch failed:', error);
          // 3. Fallback for failed network resource requests (e.g., failed API or JS file)
          // We don't serve offline.html here, just for navigation requests.
          // Returning caches.match(offline.html) here is what caused the TypeError in the resource fetch.
          return new Response(null, { status: 503, statusText: 'Service Unavailable (Offline)' });
      })
  );
});
