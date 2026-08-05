// ============================================================================
// File: src/components/shared/sw-register.tsx
// Purpose: Client component that registers /sw.js on browser idle. The
//          service worker powers Web Push notifications and the PWA install.
//
//  CRITICAL FIX (Phase 39.5 audit):
//  --------------------------------
//  Previously, registration was deferred via `requestIdleCallback(timeout:3000)`
//  and the onboarding toggle then awaited `navigator.serviceWorker.ready`.
//  On a fresh tab the SW could still be in "installing"/"activating" state when
//  the user clicked the toggle, causing:
//
//    "Failed to execute 'subscribe' on 'PushManager':
//     Subscription failed - no active Service Worker"
//
//  Fix:
//    1. Register the SW IMMEDIATELY on mount (no idle deferral) — Push API
//       is core functionality, not a nice-to-have. The registration call
//       itself is async and doesn't block first paint.
//    2. Expose a helper `window.__ensurePushReady()` that the onboarding +
//       preferences components can call to (a) register the SW if missing,
//       (b) wait for it to become ACTIVE (not just installed), and (c)
//       return the active registration. This guarantees `pushManager.subscribe`
//       never fails with "no active SW".
//    3. Add a `pushsubscriptionchange` listener that pings the server with
//       the new endpoint (so device rotation doesn't lose notifications).
//    4. Listen for `NOTIF_CLICK` messages and convert any deep-link format
//       (legacy `/account/orders`, `?view=shop`, full URL, etc.) into the
//       SPA's hash-routing format (`#v=orders`, `#v=shop`, ...).
// ============================================================================

"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __ensurePushReady?: () => Promise<ServiceWorkerRegistration | null>;
    __pmsNavigate?: (deepLink: string) => void;
  }
}

export function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // -----------------------------------------------------------------------
    // 1. EAGER registration — no idle deferral. The registration promise
    //    resolves once the SW script has been fetched + parsed + installed.
    //    Activation happens on the next tick (sw.js calls skipWaiting +
    //    clients.claim), so by the time the user clicks the toggle the SW
    //    should already be active.
    // -----------------------------------------------------------------------
    const registerSW = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Listen for SW updates — when a new SW takes over, reload once
          // so the page picks up the latest assets.
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "activated" &&
                navigator.serviceWorker.controller
              ) {
                window.location.reload();
              }
            });
          });
          return reg;
        })
        .catch((err) => {
          // SW registration failure is non-fatal — log and continue.
          console.warn("[sw] registration failed:", err);
          return null;
        });

    // Kick off registration immediately (don't await).
    registerSW();

    // -----------------------------------------------------------------------
    // 2. Helper exposed to onboarding/preferences components — guarantees
    //    the SW is registered AND active before subscribing to push.
    //    Returns the active ServiceWorkerRegistration, or null on failure.
    // -----------------------------------------------------------------------
    window.__ensurePushReady = async (): Promise<ServiceWorkerRegistration | null> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return null;
      }
      try {
        // Trigger registration (no-op if already registered).
        const reg = await registerSW();
        if (!reg) return null;

        // If the SW is already active, return immediately.
        if (reg.active) return reg;

        // Otherwise, wait for `navigator.serviceWorker.ready` which resolves
        // only when an active SW controls the page. Add a 10s timeout to
        // avoid hanging forever if something goes wrong.
        const ready = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
        ]);
        // CRITICAL FIX (Phase 42): Return null on timeout, NOT the un-activated
        // registration. Returning an un-activated reg causes pushManager.subscribe()
        // to throw "no active Service Worker" — a confusing error for the user.
        return ready; // null on timeout — caller's if(!reg) guard fires correctly
      } catch (err) {
        console.error("[sw] __ensurePushReady failed:", err);
        return null;
      }
    };

    // -----------------------------------------------------------------------
    // 3. Deep-link normalization — converts any deep link format the SW
    //    sends (legacy `/account/orders`, `?view=shop`, full URL, hash) into
    //    the SPA's hash-routing format that the store.ts listener handles.
    // -----------------------------------------------------------------------
    const normalizeDeepLink = (raw: string): string => {
      let link = raw || "/";

      // Strip origin if it's a full URL.
      if (link.startsWith("http")) {
        try {
          const url = new URL(link);
          // Prefer the hash fragment if present.
          if (url.hash) return url.hash;
          // Otherwise fall back to pathname + search.
          link = url.pathname + url.search;
        } catch {
          return "#v=home";
        }
      }

      // Already hash format: #v=orders or #v=product&productId=xxx
      if (link.startsWith("#")) return link;

      // Strip leading slash.
      if (link.startsWith("/")) link = link.substring(1);

      // Hash-prefixed path: /#v=orders → #v=orders
      if (link.startsWith("#")) return "#" + link;

      // Query-string format: ?v=orders or ?view=shop
      if (link.startsWith("?")) {
        const params = new URLSearchParams(link.substring(1));
        // Normalize `view=` to `v=` (legacy)
        if (!params.has("v") && params.has("view")) {
          params.set("v", params.get("view")!);
          params.delete("view");
        }
        const v = params.get("v");
        if (!v) return "#v=home";
        return "#" + params.toString();
      }

      // Path-style legacy deep links: account/orders, account, shop, etc.
      // Map the most common ones to their SPA hash equivalents.
      const pathMap: Record<string, string> = {
        "account/orders": "#v=orders",
        "account": "#v=account",
        "account/profile": "#v=profile",
        "account/addresses": "#v=addresses",
        "account/wishlist": "#v=wishlist",
        "shop": "#v=shop",
        "cart": "#v=cart",
        "checkout": "#v=checkout",
        "prescription": "#v=prescription",
        "manual-request": "#v=manual-request",
        "track-order": "#v=track-order",
        "categories": "#v=categories",
        "wishlist": "#v=wishlist",
        "compare": "#v=compare",
        "bundles": "#v=bundles",
        "about": "#v=about",
        "contact": "#v=contact",
        "auth": "#v=auth",
        "": "#v=home",
      };

      // Try direct map lookup.
      if (pathMap[link]) return pathMap[link];

      // Try without trailing slash.
      const trimmed = link.replace(/\/$/, "");
      if (pathMap[trimmed]) return pathMap[trimmed];

      // Unknown path — fall back to home rather than misrouting to shop.
      return "#v=home";
    };

    // -----------------------------------------------------------------------
    // 4. NOTIF_CLICK message handler — navigate to the deep link using the
    //    SPA's hash routing. Also fires a beacon to /api/app-notifs/log/[id]
    //    so the admin can track click-through rates.
    // -----------------------------------------------------------------------
    const onMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "NOTIF_CLICK") return;

      // 4a. Click tracking — fire-and-forget beacon so analytics has accurate
      //     click counts. The logId is included in the SW payload's metadata.
      if (data.logId) {
        try {
          await fetch("/api/app-notifs/log/" + data.logId + "/click", {
            method: "POST",
            keepalive: true,
          });
        } catch {}
      }

      // 4b. Navigate to the deep link.
      try {
        const hash = normalizeDeepLink(data.deepLink || "/");
        if (window.location.hash !== hash) {
          window.location.hash = hash;
        }
        // Also call the SPA's navigate hook if registered.
        if (typeof window.__pmsNavigate === "function") {
          window.__pmsNavigate(data.deepLink || "/");
        }
      } catch (e) {
        console.warn("[sw] navigation failed:", e);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      delete window.__ensurePushReady;
    };
  }, []);

  return null;
}
