// Updated service worker: network-first for navigation (index.html) and cache versioning
const CACHE_NAME = "emi-calculator-v2";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

// During install, fetch and cache assets. Use Request({cache:'reload'}) to force fresh copy.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const requests = ASSETS.map((url) => new Request(url, { cache: "reload" }));
      return cache.addAll(requests);
    })
  );
  self.skipWaiting();
});

// Remove old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler:
// - For navigation / HTML requests: try network first, update cache, fallback to cache when offline.
// - For other requests: serve from cache first, fallback to network.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // A simple way to detect navigation/HTML requests:
  const acceptHeader = req.headers.get("accept") || "";
  const isNavigation = req.mode === "navigate" || acceptHeader.includes("text/html");

  if (isNavigation) {
    // Network-first for HTML (index.html)
    event.respondWith(
      fetch(req)
        .then((networkResp) => {
          // Update the cache with fresh HTML
          caches.open(CACHE_NAME).then((cache) => {
            // put a clone into cache (non-blocking)
            try { cache.put(req, networkResp.clone()); } catch (e) {}
          });
          return networkResp;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // For other assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((networkResp) => {
        // Optionally cache runtime requests (images/CSS/JS)
        // skip caching opaque responses to avoid failures
        if (networkResp && networkResp.ok) {
          caches.open(CACHE_NAME).then((cache) => {
            try { cache.put(req, networkResp.clone()); } catch (e) {}
          });
        }
        return networkResp;
      });
    })
  );
});
