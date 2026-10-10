// Offline cache: στην εγκατάσταση αποθηκεύονται όλα τα αρχεία της εφαρμογής·
// μετά, network-first με fallback στην cache.
const CACHE = 'grafida-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(
    fetch('./precache.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((files) => caches.open(CACHE).then((c) => c.addAll(files)))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./')))
  );
});
