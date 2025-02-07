const CACHE_NAME = "my-pwa-cache-v2"; // Cambia versione della cache per forzare l'aggiornamento
const urlsToCache = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  // Cancella vecchie cache durante l'installazione
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      // Aggiungi le nuove risorse alla cache
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(urlsToCache);
      });
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Gestione dinamica delle richieste
  if (event.request.mode === "navigate") {
    // Per richieste di navigazione, forza il fetch dal server
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
  } else {
    // Per altre richieste, usa la cache prima del network
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
