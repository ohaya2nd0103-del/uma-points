const PREFIX = 'uma-points-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + 'v4-20261108-no-time-local-all-2';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./core.js','./storage.js','./catalog.js','./tickets.js','./game-calendar.js','./game-programs.js','./local-graded-programs.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate',event => event.waitUntil((async () => {
  const names = await caches.keys(); await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('message',event => { if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('fetch',event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try { const response = await fetch(event.request); if (response.ok) { await cache.put('./index.html',response.clone()); return response; } }
      catch {}
      return (await cache.match('./index.html')) || Response.error();
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    return fetch(event.request);
  })());
});
