// ============================================================================
// File: public/sw.js
// Purpose: Service Worker for PMS Pharmacy. Handles Web Push delivery +
//          notification click navigation. Registered by SWRegister on idle.
//
// Lifecycle:
//   install   → skipWaiting (activate new SW immediately, don't wait for
//               all tabs to close).
//   activate  → clients.claim() so the SW controls the page on first install
//               (otherwise the user has to refresh before push works).
//   push      → parse JSON payload, showNotification with title / body /
//               icon / image / tag / priority (renotify + requireInteraction
//               for "high" priority templates).
//   notificationclick → focus an existing PMS tab if one is open, else open
//               a new one. Navigate to the deep link from the payload.
// ============================================================================

self.addEventListener("install", (event) => {
  // Skip waiting so the new SW activates immediately on next navigation.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all open clients (pages) immediately on activation.
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// PUSH event — show a notification from the server-sent payload.
// Payload shape (sent by src/lib/push-service.ts):
//   {
//     title: string,
//     body: string,
//     icon?: string,         // small icon (left of title)
//     image?: string,        // large banner image (below body)
//     tag?: string,          // grouping tag (replaces existing notif with same tag)
//     deepLink?: string,     // /relative path to open on click
//     priority?: "normal" | "high",
//     metadata?: object      // arbitrary debug data, unused by SW
//   }
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    // Fallback: treat as plain text
    payload = { title: "PMS Pharmacy", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "PMS Pharmacy";
  const body = payload.body || "";
  const icon = payload.icon || "/icon.png";
  const image = payload.image || undefined;
  const tag = payload.tag || "pms-default";
  const priority = payload.priority || "normal";
  const deepLink = payload.deepLink || "/";

  // High-priority notifications persist until the user interacts.
  const options = {
    body,
    icon,
    badge: "/icon.png",
    tag,
    data: { deepLink, ...(payload.metadata || {}) },
    requireInteraction: priority === "high",
    renotify: priority === "high",
    vibrate: [80, 30, 80],
  };
  if (image) options.image = image;

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// NOTIFICATION CLICK — focus existing PMS tab or open a new one, then
// navigate to the deep link from the notification's data.
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const deepLink = (event.notification.data && event.notification.data.deepLink) || "/";
  // Normalize: ensure leading slash so we always navigate within the PMS origin.
  const targetUrl = deepLink.startsWith("http")
    ? deepLink
    : (deepLink.startsWith("/") ? deepLink : "/" + deepLink);

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Look for an existing PMS tab. If found, focus it + post a message
      // so the SPA router can navigate to the deep link without a full reload.
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const targetOrigin = new URL(targetUrl, self.location.origin).origin;
          if (clientUrl.origin === targetOrigin) {
            client.postMessage({ type: "NOTIF_CLICK", deepLink: targetUrl });
            try { await client.focus(); } catch {}
            return;
          }
        } catch {}
      }

      // No matching tab — open a new one.
      if (self.clients.openWindow) {
        try {
          await self.clients.openWindow(targetUrl);
        } catch {}
      }
    })()
  );
});

// ---------------------------------------------------------------------------
// MESSAGE — listen for messages from the page (e.g. SW_READY ping).
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
