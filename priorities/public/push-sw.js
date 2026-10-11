// Notifications, imported into the generated service worker (see
// vite.priorities.config.ts). The Cloudflare Worker sends each push as JSON:
// { title, body, url, tag }, from priorities/src/lib/notify.ts.

self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Priorities', {
      body: msg.body || '',
      icon: 'icon-192.png',
      tag: msg.tag,
      data: { url: new URL(msg.url || './', self.registration.scope).href },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (open) {
        await open.focus();
        if (open.url !== url) await open.navigate(url);
        return;
      }
      return self.clients.openWindow(url);
    })(),
  );
});
