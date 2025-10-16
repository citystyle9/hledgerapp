const CACHE_NAME = 'homeledger-v1.5.0'; // हर बदलाव के बाद इस नंबर को बढ़ाएं
const urlsToCache = [
  '/', // روٹ URL کو کیش کرتا ہے
  '/index.html', // آپ کی مین فائل
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  // ایپ کو انسٹال کرتے وقت تمام ضروری فائلیں کیش میں محفوظ کی جاتی ہیں
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // ہر درخواست کے لیے، پہلے کیش میں چیک کیا جاتا ہے
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // اگر کیش میں فائل موجود ہے تو اسے واپس کر دیا جاتا ہے (آف لائن کام)
        return response || fetch(event.request);
      })
  );
});
