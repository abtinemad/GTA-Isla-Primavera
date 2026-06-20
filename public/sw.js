/**
 * G-Drive Companion — Service Worker
 * Zero-dependency offline support (Spec §1.1 "Autonomie totale").
 *  - App shell: network-first for navigations, falls back to cached shell offline.
 *  - Static assets: stale-while-revalidate.
 *  - Map tiles (Esri / CARTO): cache-first with a capped tile store so the
 *    last-visited areas of Tenerife stay available without a connection.
 */
const VERSION = 'v1';
const SHELL_CACHE = `gdrive-shell-${VERSION}`;
const ASSET_CACHE = `gdrive-assets-${VERSION}`;
const TILE_CACHE = `gdrive-tiles-${VERSION}`;
const TILE_LIMIT = 500;

const TILE_HOSTS = ['arcgisonline.com', 'basemaps.cartocdn.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['/', '/index.html'])).catch(() => {})
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
          .catch(() => hit);
        return hit || fetchPromise;
      })
    );
  }
});
