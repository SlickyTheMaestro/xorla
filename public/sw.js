// Xorla service worker: makes the app installable, and shows push notifications (even when the app is closed).
// It does not cache anything yet — offline support is a separate piece of work.

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => { event.respondWith(fetch(event.request)); });

// A notification arrives from Xorla's backend
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Xorla', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Xorla';
  // Mark the app icon; Xorla sets the exact count (or clears it) when it's opened
  try { if (self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge().catch(() => {}); } catch (e) {}
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
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
