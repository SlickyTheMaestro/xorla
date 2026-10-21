// Xorla service worker: makes the app installable, shows push notifications (even when the app is closed),
// and keeps a copy of the app itself so Xorla opens with no internet.
// Only the app's own files (its code, styles and fonts) and product photos are kept. Business data is never cached here:
// the app keeps its own copy per logged-in person, and sales made offline wait in the app until they're sent.

// v2: fonts now ship inside the app's own files, so the old Google Fonts copies (and any older saved page) are cleared out
const SHELL = 'xorla-shell-v2';     // the page itself, the icon and the manifest
const ASSETS = 'xorla-assets-v2';   // the app's code, styles and fonts (their names change with every update)
const PHOTOS = 'xorla-photos-v1';   // product pictures, so the picture view works offline
const KEEP = [SHELL, ASSETS, PHOTOS];
const PAGE_KEY = '/__xorla_page';   // one copy of the page serves every address in the app

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then(async (c) => {
    try { const r = await fetch('/', { cache: 'no-store' }); if (r.ok) await c.put(PAGE_KEY, r); } catch (e) {}
    try { await c.add('/manifest.json'); } catch (e) {}
  }));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('xorla-') && !KEEP.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Keep a cache from growing forever: oldest entries go first
async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
async function cacheFirst(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) { await c.put(req, res.clone()); if (max) trim(name, max); }
  return res;
}
async function staleWhileRevalidate(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const fresh = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}
// The page: always try the internet first (so updates arrive), but don't keep someone on a weak network
// waiting forever: after a few seconds, open the saved copy instead.
// The newest page is always saved once it arrives, even if the saved copy was shown first, so a slow network
// never keeps someone on an old version.
async function pageRequest(event) {
  const req = event.request;
  const c = await caches.open(SHELL);
  const net = fetch(req, { cache: 'no-store' }).then(async (res) => { if (res && res.ok && (res.headers.get('content-type') || '').includes('text/html')) await c.put(PAGE_KEY, res.clone()); return res; });
  event.waitUntil(net.catch(() => {}));
  const saved = await c.match(PAGE_KEY);
  if (!saved) return net;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 4500));
  try { const first = await Promise.race([net, timeout]); if (first) return first; } catch (e) { return saved; }
  return saved;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { event.respondWith(pageRequest(event)); return; }
    if (url.pathname.startsWith('/assets/')) { event.respondWith(cacheFirst(req, ASSETS, 120)); return; }
    if (/\.(png|jpg|jpeg|svg|ico|webp|json|webmanifest)$/.test(url.pathname) && url.pathname !== '/sw.js') { event.respondWith(staleWhileRevalidate(req, SHELL)); return; }
    return;
  }
  // Product and logo pictures stored in Xorla's database storage (public links only, never private documents)
  if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) { event.respondWith(cacheFirst(req, PHOTOS, 400)); return; }
  // Everything else (the database, payments, WhatsApp) goes straight to the internet, untouched
});

// The open app tells us which files it's using, so a first visit is enough for the next one to work offline
self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'xorla-warm' && Array.isArray(d.urls)) {
    event.waitUntil(Promise.all(d.urls.slice(0, 40).map(async (u) => {
      try {
        const url = new URL(u, self.location.origin);
        if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) await cacheFirst(new Request(url.href), ASSETS, 120);
      } catch (e) {}
    })).then(async () => {
      try { const c = await caches.open(SHELL); if (!(await c.match(PAGE_KEY))) { const r = await fetch('/', { cache: 'no-store' }); if (r.ok) await c.put(PAGE_KEY, r); } } catch (e) {}
    }));
  }
});

// A notification arrives from Xorla's backend
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Xorla', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Xorla';
  // If Xorla is open, tell it straight away so it can update (new support reply, new order…) without a refresh
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((wins) => wins.forEach((w) => w.postMessage({ type: 'xorla-push', url: data.url || '/', tag: data.tag || '' }))).catch(() => {}));
  // Mark the app icon; Xorla sets the exact count (or clears it) when it's opened
  try { if (self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge().catch(() => {}); } catch (e) {}
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [120, 60, 120],
    timestamp: Date.now(),
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/' },
  }));
});

// Tapping a notification opens Xorla on the right screen (reusing an open window if there is one)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin)) {
        await w.focus();
        w.postMessage({ type: 'xorla-open', url: target });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
