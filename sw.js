// Versioned, network-first cache for app files so updates are picked up reliably.
const CACHE = 'burrito-radar-v2';
const CORE = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('burrito-radar-') && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET') return;
  // For the shell, prefer the latest deployed file, but fall back to cache when offline.
  if (CORE.some(path => url.pathname.endsWith(path.replace('./', '/')) || (path === './' && url.pathname.endsWith('/')))) {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('./index.html'))));
  }
});
