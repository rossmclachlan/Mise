// Mise's service worker used to live here, with scope /Mise/, which also
// covered Tandem at /Mise/tandem/. Mise now has its own worker under
// /Mise/meals/. Browsers that still have the old worker fetch this file on
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
