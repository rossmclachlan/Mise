// A service worker used to live at this scope: Mise's at /Mise/ (which also
// covered the to-do app), and the to-do app's at /Mise/tandem/ before it was
// renamed Priorities. Mise now lives at /Mise/meals/ and Priorities at
// /Mise/priorities/. Browsers that still have the old worker fetch this file on
// their next update check: it clears the old cache, unregisters itself and
// reloads any open pages so they pick up the new apps.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.endsWith(scope) || k.endsWith(scope.slice(0, -1))).map((k) => caches.delete(k)),
      );
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
