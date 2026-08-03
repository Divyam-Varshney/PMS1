// ============================================================================
// File: src/components/shared/sw-register.tsx
// Purpose: Client component that registers /sw.js on browser idle. The
//          service worker powers Web Push notifications and the PWA install.
// Role: Rendered once in src/app/layout.tsx (root layout) so every page has
//       the SW available. Uses requestIdleCallback to avoid blocking first
//       paint, and is a no-op on unsupported browsers (SSR safe).
// ============================================================================

"use client";

import { useEffect } from "react";

export function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Listen for updates — when a new SW takes over, reload once so the
          // page picks up the latest assets. Without this the user would be
          // stuck on the old JS bundle until they manually refresh.
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "activated" &&
                navigator.serviceWorker.controller
              ) {
                // The new SW is now active — softly reload the page.
                window.location.reload();
              }
            });
          });
        })
        .catch((err) => {
          // SW registration failure is non-fatal — log and continue.
          console.warn("[sw] registration failed:", err);
        });
    };

    // Defer registration until the browser is idle to avoid competing with
    // first paint / TTI. requestIdleCallback is widely supported; the timeout
    // fallback covers Safari < 17.
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(register, { timeout: 3000 });
    } else {
      setTimeout(register, 1500);
    }

    // Listen for NOTIF_CLICK messages from the SW — navigate to the deep link
    // using hash routing (the SPA uses #v=product&productId=xxx&slug=yyy).
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "NOTIF_CLICK" || !data.deepLink) return;
      try {
        // The deep link may be in query param format (?view=product&productId=xxx)
        // or hash format (#v=product&productId=xxx). Normalize to hash format.
        let link = data.deepLink;
        if (link.startsWith("/?")) {
          // Convert /?v=product&productId=xxx to #v=product&productId=xxx
          const params = link.substring(2);
          link = "#" + params.replace(/^v=/, "v=").replace(/^view=/, "v=");
        } else if (link.startsWith("/#")) {
          // Already hash format — use as-is
          link = link.substring(1);
        } else if (link.startsWith("#")) {
          // Already hash
        } else if (link.startsWith("http")) {
          // Full URL — extract just the hash part
          const url = new URL(link);
          if (url.hash) {
            link = url.hash;
          } else if (url.search) {
            link = "#" + url.search.substring(1).replace(/^view=/, "v=");
          } else {
            link = "#v=home";
          }
        } else {
          // Just a path like /shop → convert to hash
          link = "#v=shop";
        }
        // Set the hash — the SPA store listens to hashchange
        if (window.location.hash !== link) {
          window.location.hash = link;
        }
      } catch (e) {
        console.warn("[sw] navigation failed:", e);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
