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

    // Listen for NOTIF_CLICK messages from the SW — let the SPA router
    // navigate to the deep link without a full page reload. The actual
    // navigation is delegated to the customer UI store (window.__pmsNavigate).
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "NOTIF_CLICK" || !data.deepLink) return;
      try {
        const nav = (window as any).__pmsNavigate;
        if (typeof nav === "function") {
          nav(data.deepLink);
        }
      } catch {}
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
