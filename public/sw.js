const RESULT_SHOWN_MS = 4000;

const ASSET_CACHE = "heycapy-assets";
const PAGE_CACHE = "heycapy-page";
const PAGE_KEY = "/";
const OFFLINE_PAGE = "/offline.html";
const ASSET_MAX_ENTRIES = 300;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(Promise.all([self.clients.claim(), precacheOfflinePage()]))
);

async function precacheOfflinePage() {
  try {
    await (await caches.open(PAGE_CACHE)).add(OFFLINE_PAGE);
  } catch {}
}

async function forgetPage() {
  await (await caches.open(PAGE_CACHE)).delete(PAGE_KEY);
}

async function savePage(response) {
  await (await caches.open(PAGE_CACHE)).put(PAGE_KEY, response);
}

async function openPage(event, url) {
  const isApp = url.pathname === PAGE_KEY;
  try {
    const response = await fetch(event.request);
    if (isApp && response.ok) event.waitUntil(savePage(response.clone()));
    if (isApp && response.type === "opaqueredirect") event.waitUntil(forgetPage());
    return response;
  } catch {
    const options = { cacheName: PAGE_CACHE, ignoreVary: true };
    return (
      (isApp && (await caches.match(PAGE_KEY, options))) ||
      (await caches.match(OFFLINE_PAGE, options)) ||
      Response.error()
    );
  }
}

async function trimAssets(cache) {
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - ASSET_MAX_ENTRIES)).map((k) => cache.delete(k))
  );
}

async function saveAsset(cache, request, response) {
  await cache.put(request, response);
  await trimAssets(cache);
}

async function cacheFirst(event) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const response = await fetch(event.request);
  if (response.ok) event.waitUntil(saveAsset(cache, event.request, response.clone()));
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request).then((response) => {
    if (response.ok) event.waitUntil(saveAsset(cache, event.request, response.clone()));
    return response;
  });
  if (!hit) return refresh;
  event.waitUntil(refresh.catch(() => {}));
  return hit;
}

// The cached page holds one person's lists, so any visit to the login page drops it
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/login")) event.waitUntil(forgetPage());

  if (request.mode === "navigate") {
    event.respondWith(openPage(event, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event));
  } else if (url.pathname.startsWith("/sprites/") || url.pathname.startsWith("/icon-")) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const actions = data.actions || [];
  event.waitUntil(
    self.registration.showNotification(data.title || "HeyCapy", {
      body: data.body || "",
      icon: "/icon-192.png",
      tag: data.tag,
      // A reminder that repeats for the same item should alert again, not update silently
      renotify: Boolean(data.tag),
      actions: actions.map((a) => ({ action: a.action, title: a.title })),
      data: {
        url: data.url || "/",
        tokens: Object.fromEntries(actions.map((a) => [a.action, a.token])),
      },
    })
  );
});

async function runAction(notification, token) {
  let message = "couldn't reach heycapy — open the app to do it there";
  try {
    const res = await fetch("/api/reminder-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    message = (await res.json()).message || message;
  } catch {}
  await self.registration.showNotification(notification.title, {
    body: message,
    icon: "/icon-192.png",
    tag: notification.tag,
    silent: true,
  });
  await new Promise((resolve) => setTimeout(resolve, RESULT_SHOWN_MS));
  const shown = await self.registration.getNotifications({ tag: notification.tag });
  shown.forEach((n) => n.body === message && n.close());
}

async function openApp(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
  if (!open) return self.clients.openWindow(url);
  await open.focus();
  try {
    return await open.navigate(url);
  } catch {
    return self.clients.openWindow(url);
  }
}

self.addEventListener("notificationclick", (event) => {
  const { notification, action } = event;
  const data = notification.data || {};
  notification.close();
  const token = action && data.tokens ? data.tokens[action] : null;
  event.waitUntil(token ? runAction(notification, token) : openApp(data.url || "/"));
});
