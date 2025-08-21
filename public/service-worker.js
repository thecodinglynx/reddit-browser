// Simple service worker for PWA
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Don't try to handle cross-origin requests here (avoids CORS/service worker fetch failures)
  if (new URL(event.request.url).origin !== self.location.origin) {
    // Let the browser handle it normally
    return;
  }

  event.respondWith(
    caches.open("reddit-browser-cache").then((cache) => {
      return cache.match(event.request).then((response) => {
        if (response) return response;
        // Try network fetch, but do not let a network failure reject the respondWith promise
        return fetch(event.request)
          .then((networkResponse) => {
            if (
              event.request.method === "GET" &&
              networkResponse &&
              networkResponse.ok
            ) {
              try {
                cache.put(event.request, networkResponse.clone());
              } catch (e) {
                // ignore caching errors
              }
            }
            return networkResponse;
          })
          .catch(() => {
            // On failure, respond with a fallback if available, or nothing (so the page can handle it)
            return caches.match("/offline.html");
          });
      });
    })
  );
});
