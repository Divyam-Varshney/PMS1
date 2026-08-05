// ============================================================================
// File: src/lib/store.ts
// Purpose: Global client UI state (Zustand). Drives the SPA-style navigation
//          on the customer site. The current view is synced to the URL hash
//          (#v=orders, #v=product&id=xyz, ...) so that a browser refresh
//          preserves the current page — fixing the "refresh redirects to home"
//          bug. Back/forward buttons also work via popstate.
// ============================================================================

import { create } from "zustand";

export type CustomerView =
  | { name: "home" }
  | { name: "shop"; categoryId?: string; brandId?: string; query?: string; sort?: string }
  | { name: "product"; productId: string; slug?: string }
  | { name: "cart" }
  | { name: "checkout" }
  | { name: "order-success"; orderId: string }
  | { name: "prescription" }
  | { name: "manual-request" }
  | { name: "track-order"; orderId: string }
  | { name: "auth"; mode: "login" | "register" }
  | { name: "account" }
  | { name: "orders" }
  | { name: "addresses" }
  | { name: "profile" }
  | { name: "wishlist" }
  | { name: "stock-alerts" }
  | { name: "reminders" }
  | { name: "about" }
  | { name: "contact" }
  | { name: "categories" }
  | { name: "terms" }
  | { name: "refund-policy" }
  | { name: "health-tip"; tipId: number }
  | { name: "compare" }
  | { name: "bundles" }
  | { name: "notification-permission" };

// ---------------------------------------------------------------------------
// URL hash <-> CustomerView serialization
// ---------------------------------------------------------------------------

function viewToHash(view: CustomerView): string {
  const parts = [`v=${encodeURIComponent(view.name)}`];
  for (const [k, v] of Object.entries(view)) {
    if (k === "name") continue;
    if (v != null) parts.push(`${k}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

function hashToView(hash: string): CustomerView {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const name = params.get("v") as CustomerView["name"] | null;
  if (!name) return { name: "home" };
  switch (name) {
    case "shop":
      return { name: "shop", categoryId: params.get("categoryId") || undefined, brandId: params.get("brandId") || undefined, query: params.get("query") || undefined, sort: params.get("sort") || undefined };
    case "product":
      return { name: "product", productId: params.get("productId") || "", slug: params.get("slug") || undefined };
    case "order-success":
      return { name: "order-success", orderId: params.get("orderId") || "" };
    case "track-order":
      return { name: "track-order", orderId: params.get("orderId") || "" };
    case "health-tip":
      return { name: "health-tip", tipId: Number(params.get("tipId") || "0") };
    case "auth":
      return { name: "auth", mode: (params.get("mode") as "login" | "register") || "login" };
    default:
      if (["home","cart","checkout","prescription","manual-request","account","orders","addresses","profile","wishlist","stock-alerts","reminders","about","contact","categories","terms","refund-policy","compare","bundles","notification-permission"].includes(name)) {
        return { name } as CustomerView;
      }
      return { name: "home" };
  }
}

interface UIState {
  view: CustomerView;
  history: CustomerView[];
  navigate: (view: CustomerView) => void;
  back: () => void;
  canGoBack: () => boolean;
  restoreFromHash: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

export const useUI = create<UIState>((set, get) => ({
  view: { name: "home" },
  history: [],
  navigate: (view) => {
    set((s) => ({ view, history: [...s.history, s.view], menuOpen: false, searchOpen: false }));
    if (typeof window !== "undefined") {
      const hash = "#" + viewToHash(view);
      if (window.location.hash !== hash) {
        window.history.pushState({ view }, "", hash);
      }
    }
  },
  back: () => {
    const h = get().history;
    if (h.length === 0) {
      set({ view: { name: "home" } });
      if (typeof window !== "undefined") window.history.pushState({}, "", "#v=home");
      return;
    }
    const prev = h[h.length - 1];
    set({ view: prev, history: h.slice(0, -1) });
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "#" + viewToHash(prev));
    }
  },
  canGoBack: () => get().history.length > 0,
  restoreFromHash: () => {
    if (typeof window === "undefined") return;
    if (window.location.hash) {
      set({ view: hashToView(window.location.hash) });
    }
  },
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  menuOpen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
}));

// Listen for browser back/forward (popstate) — guarded against HMR double-registration
if (typeof window !== "undefined") {
  if (!(window as any).__pmsCustomerPopState) {
    (window as any).__pmsCustomerPopState = true;
    window.addEventListener("popstate", () => {
      useUI.setState({ view: hashToView(window.location.hash) });
    });
  }
}
