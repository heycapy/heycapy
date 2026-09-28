const RESULT_SHOWN_MS = 4000;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
