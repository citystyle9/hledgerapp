const CACHE_NAME = 'homeledger-v1.5.2'; // <<-- یہ لائن اپ ڈیٹ کر دی گئی ہے۔
const urlsToCache = [
  '/hledgerapp/', // روٹ URL کو کیچ کرتا ہے (Github Pages URL)
  '/hledgerapp/index.html', // آپ کی مین فائل
  '/hledgerapp/manifest.json',
  // آئیکنز کو بھی کیچ کرنا ضروری ہے
  '/hledgerapp/icons/icon-192x192.png',
  '/hledgerapp/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  // ایپ کو انسٹال کرتے وقت تمام ضروری فائلیں کیش میں محفوظ کی جاتی ہیں
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching assets.');
        // تمام URLs کو کیش میں شامل کریں
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Worker کو فورا activate کرنے کے لیے
      .catch(err => {
        console.error('[Service Worker] Caching failed:', err);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  // پرانے caches کو ہٹانا
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // صرف وہی کیش ہٹائیں جو موجودہ CACHE_NAME سے مختلف ہے
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // یقینی بناتا ہے کہ worker تمام tabs کو کنٹرول کرے
  );
});

self.addEventListener('fetch', event => {
  // اگر درخواست ایک نیویگیشن ہے (یعنی نیا صفحہ کھولا جا رہا ہے)
  if (event.request.mode === 'navigate') {
    // کیش سے index.html کو serve کریں
    event.respondWith(caches.match('/hledgerapp/index.html').catch(() => fetch(event.request)));
    return;
  }
  
  // باقی تمام فائلوں (CSS, JS, Icons) کے لیے، پہلے کیش میں دیکھیں
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // اگر کیش میں فائل موجود ہے تو اسے واپس کر دیا جاتا ہے (آف لائن کام)
        if (response) {
            return response;
        }
        
        // اگر کیش میں نہیں ہے تو نیٹ ورک سے fetch کریں
        return fetch(event.request);
      })
      .catch(error => {
          console.error('Fetch failed:', error);
          // یہاں آپ ایک آف لائن Fallback Page بھی شامل کر سکتے ہیں
      })
  );
});
