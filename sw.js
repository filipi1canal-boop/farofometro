const CACHE = 'farofometro-v5';
const ASSETS = ['./', './index.html', './style.css', './app.js', './sync.js', './pwa.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'notification') return;
  const n = event.data.notification;
  event.waitUntil(self.registration.showNotification(n.title || 'Farofômetro', {
    body: n.body || '', icon: './icon.svg', badge: './icon.svg', data: { url: n.url || 'votar.html' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data && event.notification.data.url || 'votar.html'));
});
