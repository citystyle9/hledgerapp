const CACHE_NAME = 'homeledger-v1.5.3'; // Updated to match app version
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

self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  // When installing the app, all necessary files are saved in the cache
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching assets.');
        // Add all URLs to the cache
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
  // If the request is a navigation (i.e., opening a new page)
  if (event.request.mode === 'navigate') {
    // Serve index.html from cache
    event.respondWith(caches.match(basePath + 'index.html').catch(() => caches.match(basePath + 'offline.html')));
    return;
  }
  
  // For all other files (CSS, JS, Icons), check the cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If the file is in the cache, it is returned (offline work)
        if (response) {
            return response;
        }
        
        // If not in cache, fetch from network
        return fetch(event.request);
      })
      .catch(error => {
          console.error('Fetch failed:', error);
          // New: Offline Fallback Page added here
          return caches.match(basePath + 'offline.html');
      })
  );
});
