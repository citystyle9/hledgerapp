const CACHE_NAME = 'homeledger-v1.5.0'; // हर बदलाव के बाद इस नंबर को बढ़ाएं
const urlsToCache = [
  '/hledgerapp/', // روٹ URL को कैच करता है (Github Pages URL)
  '/hledgerapp/index.html', // आपकी मेन फाइल
  '/hledgerapp/manifest.json',
  '/hledgerapp/icons/icon-192x192.png',
  '/hledgerapp/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  // ऐप को इंस्टॉल करते समय सभी जरूरी फाइलें कैश में सुरक्षित की जाती हैं
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching assets.');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Worker को तुरंत activate करने के लिए
      .catch(err => {
        console.error('[Service Worker] Caching failed:', err);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  // पुराने caches को हटाना
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
    }).then(() => self.clients.claim()) // सुनिश्चित करता है कि worker सभी tabs को नियंत्रित करे
  );
});

self.addEventListener('fetch', event => {
  // हर अनुरोध के लिए, पहले कैश में चेक किया जाता है
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // अगर कैश में फाइल मौजूद है तो उसे वापस कर दिया जाता है (आफलाइन काम)
        if (response) {
            return response;
        }
        
        // अगर कैच में नहीं है, तो नेटवर्क से लाएं
        return fetch(event.request);
      })
  );
});
