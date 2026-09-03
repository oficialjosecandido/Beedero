const CACHE_NAME = "beedero-shell-v1";
const OFFLINE_URL = "/offline";
const FIREBASE_SDK_VERSION = "12.18.0";

// FCM background push — only wired up if the client passed a config (see
// ServiceWorkerRegistration.tsx). A load/init failure here must never break
// the app-shell caching below, hence the broad try/catch.
(function setUpPush() {
  const params = new URLSearchParams(self.location.search);
  const rawConfig = params.get("fcfg");
  if (!rawConfig) return;

  try {
    importScripts(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`,
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`,
    );
    firebase.initializeApp(JSON.parse(rawConfig));
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const link = (payload.fcmOptions && payload.fcmOptions.link) || payload.data?.link || "/";
      self.registration.showNotification(notification.title || "Beedero", {
        body: notification.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { link },
      });
    });
  } catch {
    // Push is a progressive enhancement — ignore init failures.
  }
})();

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(link) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    }),
  );
});

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Static, content-hashed build assets — safe to cache aggressively.
function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/fonts/") ||
      url.pathname === "/favicon.svg")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API calls or any cross-origin request — always network,
  // never cached. This includes auth, Next.js route-handler proxies under
  // /api/, and anything authenticated.
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) {
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Page navigations: always go to the network (never cache HTML, which may
  // be personalized/authenticated). Only fall back to the static offline
  // page when the network is unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res || Response.error())),
    );
    return;
  }

  // Everything else (data fetches, images, etc.): pass through to network.
});
