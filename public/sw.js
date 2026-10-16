// Offline cache: στην εγκατάσταση αποθηκεύονται όλα τα αρχεία της εφαρμογής·
// μετά, network-first με fallback στην cache.
const CACHE = 'grafida-v2';
const SHARED = 'grafida-shared';

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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHARED).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// «Κοινοποίηση» από άλλη εφαρμογή της συσκευής (π.χ. στιγμιότυπο οθόνης → Κοινοποίηση → PrismaBoard, βλ. share_target στο manifest):
// τα αρχεία φυλάγονται εδώ και η εφαρμογή ανοίγει και τα βάζει στη σελίδα (βλ. main.ts).
async function receiveShare(req) {
  try {
    const files = (await req.formData()).getAll('files').filter((f) => f instanceof File);
    await caches.delete(SHARED);
    const c = await caches.open(SHARED);
    await Promise.all(files.map((f, i) => c.put(`./shared/${i}`, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name) } }))));
  } catch {
    /* ό,τι δεν διαβάστηκε απλώς δεν μπαίνει */
  }
  return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share')) {
    e.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // μόνο ολόκληρες απαντήσεις: τα βίντεο έρχονται σε κομμάτια (206), που δεν αποθηκεύονται
        if (res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./')))
  );
});
