const CACHE_NAME = 'homeledger-v1.5.0'; // हर बदलाव के बाद इस नंबर को बढ़ाएं
const urlsToCache = [
  '/', 
  '/index.html', 
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 1. Install Event (آپ کا موجودہ کوڈ):
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching assets.');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // فوری طور پر worker کو activate کرنے کے لیے
  );
});

// 2. Activate Event (پرانے کیش کو صاف کرنے کے لیے شامل کیا گیا):
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  // پرانے caches کو ہٹانا
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // یقینی بناتا ہے کہ worker تمام صفحات کو کنٹرول کرے۔
  );
});


// 3. Fetch Event (آپ کا موجودہ کوڈ):
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
