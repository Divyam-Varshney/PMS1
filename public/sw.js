// ============================================================================
// File: public/sw.js
// Purpose: Service Worker for PMS Pharmacy. Handles Web Push delivery,
//          notification click navigation, and subscription lifecycle events.
//
//  Events handled:
//    install                  → skipWaiting (activate new SW immediately)
//    activate                 → clients.claim (control page on first install)
//    push                     → showNotification with title/body/icon/image/tag/deepLink
//    notificationclick        → focus existing PMS tab + navigate to deep link
//    pushsubscriptionchange   → re-subscribe + notify server of new endpoint
//    message                  → SKIP_WAITING (update flow)
//
//  Payload shape (sent by src/lib/push-service.ts):
//    {
//      title: string,
//      body: string,
//      icon?: string,           // small icon (left of title)
//      image?: string,          // large banner image (below body)
//      tag?: string,            // grouping tag (replaces existing notif with same tag)
//      deepLink?: string,       // /relative path to open on click
//      priority?: "normal" | "high",
//      logId?: string,          // AppNotifLog row ID for click tracking
//      metadata?: object
//    }
// ============================================================================

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// PUSH event — show a notification from the server-sent payload.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "PMS Pharmacy", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "PMS Pharmacy";
  const body = payload.body || "";
  const icon = payload.icon || "/icon.png";
  const image = payload.image || undefined;
  const tag = payload.tag || "pms-default";
  const priority = payload.priority || "normal";
  const deepLink = payload.deepLink || "/";
  const logId = payload.logId || null;

  const options = {
    body,
    icon,
    badge: "/icon.png",
    tag,
    data: {
      deepLink,
      logId,
      ...(payload.metadata || {}),
    },
    requireInteraction: priority === "high",
    renotify: priority === "high",
    vibrate: [80, 30, 80],
  };
  if (image) options.image = image;

  event.waitUntil(
    (async () => {
      // Show the notification. Also bump the AppNotifLog "sent" status if a
      // logId was provided — this lets us track delivery vs. click rates.
      await self.registration.showNotification(title, options);

      // Fire-and-forget delivery beacon. The endpoint is best-effort — if
      // it fails (e.g. offline), we just skip the bump. Using keepalive so
      // the SW doesn't have to stay alive for the response.
      if (logId) {
        try {
          await fetch("/api/app-notifs/log/" + logId + "/delivered", {
            method: "POST",
            keepalive: true,
          });
        } catch {}
      }
    })()
  );
});

// ---------------------------------------------------------------------------
// NOTIFICATION CLICK — focus existing PMS tab or open a new one, then
// navigate to the deep link from the notification's data.
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const deepLink = data.deepLink || "/";
  const logId = data.logId || null;
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
            client.postMessage({
              type: "NOTIF_CLICK",
              deepLink: targetUrl,
              logId,
            });
            try { await client.focus(); } catch {}
            return;
          }
        } catch {}
      }

      // No matching tab — open a new one with the deep link as the URL.
      // The SPA's hashchange listener will pick it up on load.
      if (self.clients.openWindow) {
        try {
          // Convert /?v=orders or /account/orders → /#v=orders so the SPA
          // picks it up from the initial URL hash.
          const hashUrl = await normalizeForNewTab(targetUrl);
          await self.clients.openWindow(hashUrl);
        } catch {}
      }
    })()
  );
});

// ---------------------------------------------------------------------------
// Convert a deep link into a URL the SPA will route correctly when opened
// in a NEW tab (no existing client). The SPA listens to window.location.hash
// on initial load, so we need to put the route into the hash fragment.
// ---------------------------------------------------------------------------
async function normalizeForNewTab(targetUrl) {
  // Already has a hash — keep as-is.
  if (targetUrl.includes("#")) return targetUrl;

  // /?v=orders&productId=xxx → /#v=orders&productId=xxx
  if (targetUrl.startsWith("/?")) {
    return "/#" + targetUrl.substring(2);
  }
  if (targetUrl.startsWith("?")) {
    return "/#" + targetUrl.substring(1);
  }

  // Legacy path-style deep links → map to hash.
  const pathMap = {
    "/account/orders": "/#v=orders",
    "/account": "/#v=account",
    "/account/profile": "/#v=profile",
    "/account/addresses": "/#v=addresses",
    "/shop": "/#v=shop",
    "/cart": "/#v=cart",
    "/checkout": "/#v=checkout",
    "/prescription": "/#v=prescription",
    "/track-order": "/#v=track-order",
    "/categories": "/#v=categories",
    "/wishlist": "/#v=wishlist",
    "/about": "/#v=about",
    "/contact": "/#v=contact",
  };
  if (pathMap[targetUrl]) return pathMap[targetUrl];
  // Default — open the home page.
  return "/#v=home";
}

// ---------------------------------------------------------------------------
// PUSH SUBSCRIPTION CHANGE — the browser rotates the push endpoint (e.g.
// when the user clears site data, or the push service expires the old
// endpoint). We need to:
//   1. Unsubscribe the old subscription (if any)
//   2. Subscribe to a new one with the same VAPID key
//   3. POST the new endpoint to the server so future pushes reach the device
// ---------------------------------------------------------------------------
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint = event.oldSubscription
        ? event.oldSubscription.endpoint
        : null;

      // Try to fetch the VAPID public key from the server.
      let vapidKey = null;
      try {
        const res = await fetch("/api/push/vapid-public");
        const json = await res.json();
        vapidKey = json?.data?.publicKey || null;
      } catch {}

      if (!vapidKey) {
        console.warn("[sw] pushsubscriptionchange: no VAPID key available, cannot re-subscribe");
        return;
      }

      // Subscribe to a new push subscription.
      try {
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        const sub = newSub.toJSON();

        // Notify the server — POST the new endpoint + unsubscribe the old.
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: sub.keys,
            oldEndpoint,
          }),
        });
      } catch (err) {
        console.error("[sw] pushsubscriptionchange: re-subscribe failed:", err);
      }
    })()
  );
});

// ---------------------------------------------------------------------------
// MESSAGE — listen for messages from the page (e.g. SKIP_WAITING for SW
// updates, or a ping to verify the SW is alive).
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// Helper — convert base64url VAPID key to Uint8Array (for subscribe()).
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}
