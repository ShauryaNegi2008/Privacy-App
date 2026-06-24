// ============================================================
// HUSH — SERVICE WORKER
// Caches the app shell (HTML/CSS/JS) so the app itself opens
// offline. Actual message data lives in IndexedDB, handled
// separately by db.js / sync.js — this file only deals with
// making the app's own files available with no connection.
// ============================================================

const CACHE_NAME = "hush-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.js",
  "./js/db.js",
  "./js/crypto.js",
  "./js/auth.js",
  "./js/drive.js",
  "./js/calculator.js",
  "./js/media.js",
  "./js/chat.js",
  "./js/sync.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// Network-first for navigation/app-shell files (so you always get
// the latest build when online), falling back to cache when offline.
// Drive API calls are NOT intercepted here — they go straight to
// the network, since they need real auth/online behavior.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin.includes("googleapis.com") || url.origin.includes("google.com")) {
    return; // let Google/Drive requests pass through untouched
  }
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
