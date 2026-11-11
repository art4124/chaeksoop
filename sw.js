/* 책숲 v1.2 offline cache. Published-book links remain external. */
const CACHE = 'chaeksoop-shell-v1.3.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './stories.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('chaeksoop-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request)).catch(() =>
      request.mode === 'navigate' ? caches.match('./index.html') : Response.error()
    )
  );
});