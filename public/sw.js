// Nox service worker — background notifications only (never caches app assets)

const CACHE = "nox-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      // Defensive: purge any caches a previous SW version may have created so we
      // can never serve stale JS/CSS. This SW intentionally has no fetch handler.
      for (const key of await caches.keys()) await caches.delete(key);
      await clients.claim();
    })()
  );
});

// Show notification triggered from the page via postMessage
self.addEventListener("message", (e) => {
  if (e.data?.type !== "NOX_NOTIFY") return;
  const { title, body, tag, icon } = e.data;
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag || "nox-msg",
      icon: icon || "/icon-192.png",
      badge: "/icon-192.png",
      renotify: true,
      requireInteraction: false,
      silent: false,
      vibrate: [100, 50, 100],
      data: { url: self.location.origin },
    })
  );
});

// Clicking a notification focuses (or opens) the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url && "focus" in c) return c.focus();
        }
        return clients.openWindow(e.notification.data?.url || "/");
      })
  );
});
