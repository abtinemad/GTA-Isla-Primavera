/**
 * G-Drive Companion — Service Worker
 * Zero-dependency offline support (Spec §1.1 "Autonomie totale").
 *  - App shell: network-first for navigations, falls back to cached shell offline.
 *  - Static assets: stale-while-revalidate.
 *  - Map tiles (Esri / CARTO): cache-first with a capped tile store so the
 *    last-visited areas of Tenerife stay available without a connection.
 */
const VERSION = 'v6';
const SHELL_CACHE = `gdrive-shell-${VERSION}`;
const ASSET_CACHE = `gdrive-assets-${VERSION}`;
const TILE_CACHE = `gdrive-tiles-${VERSION}`;
const TILE_LIMIT = 500;

const TILE_HOSTS = ['arcgisonline.com', 'basemaps.cartocdn.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Splash artwork précaché → premier affichage garanti même hors-ligne.
      .then((cache) => cache.addAll(['/', '/index.html', '/assets/splash.webp']))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, ASSET_CACHE, TILE_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Map tiles — cache-first, capped
  if (TILE_HOSTS.some((h) => url.hostname.includes(h))) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && res.status === 200) {
            cache.put(req, res.clone());
            trimCache(TILE_CACHE, TILE_LIMIT);
          }
          return res;
        } catch (e) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // App navigations — network-first with offline shell fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // PWA identity (manifest) — network-first so the installed app name/icons
  // refresh instead of being served stale from cache.
  if (url.origin === self.location.origin && url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(ASSET_CACHE).then((c) => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || Response.error())),
    );
    return;
  }

  // Same-origin static assets — stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          // Offline + uncached: never resolve to undefined (respondWith would throw).
          .catch(() => hit || Response.error());
        return hit || fetchPromise;
      })
    );
  }
});

// Tapping an approach notification focuses the running app (or opens it).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow('/');
      })
  );
});
