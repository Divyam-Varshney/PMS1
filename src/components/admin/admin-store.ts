// ============================================================================
// File: src/components/admin/admin-store.ts
// Purpose: Zustand store that drives the admin SPA — view navigation + history
//          + cart drawer-less sidebar state. Mirrors the customer useUI pattern
//          but for the admin panel route `/admin`.
// Role: Single source of truth for which admin "view" is currently rendered
//       so the single Next.js route `/admin` can switch panels without reloads.
// ============================================================================

import { create } from "zustand";

export type AdminView =
  | { name: "dashboard" }
  | { name: "products" }
  | { name: "product-edit"; id?: string }
  | { name: "brands" }
  | { name: "categories" }
  | { name: "orders" }
  | { name: "order-detail"; id: string }
  | { name: "prescriptions" }
  | { name: "prescription-detail"; id: string }
  | { name: "manual-requests" }
  | { name: "manual-request-detail"; id: string }
  | { name: "customers" }
  | { name: "customer-detail"; id: string }
  | { name: "vouchers" }
  | { name: "delivery-zones" }
  | { name: "payment-methods" }
  | { name: "reviews" }
  | { name: "notifications" }
  | { name: "notification-templates" }
  | { name: "settings"; section?: string }
  | { name: "admins" }
  | { name: "reports" }
  | { name: "offers" }
  | { name: "deals" }
  | { name: "newsletter" }
  | { name: "campaigns" }
  | { name: "backups" }
  | { name: "database" }
  | { name: "error-logs" }
  | { name: "ai-marketing" };

interface AdminState {
  view: AdminView;
  history: AdminView[];
  navigate: (view: AdminView) => void;
  back: () => void;
  canGoBack: () => boolean;
  // search query kept in store so list views can share with each other
  storeOpenQuickToggle: boolean;
  setStoreOpenQuickToggle: (v: boolean) => void;
  // One-shot pre-fill for the Products view's stock filter. Set by the
  // dashboard's "Inventory Alerts → View all" button so the user lands on the
  // Products view already filtered to low-stock / out-of-stock items.
  // Consumed (and cleared) by ProductsView on mount.
  productsStockFilter: "all" | "low" | "out";
  setProductsStockFilter: (v: "all" | "low" | "out") => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  view: { name: "dashboard" },
  history: [],
  navigate: (view) =>
    set((s) => ({
      view,
      history: [...s.history, s.view].slice(-30), // cap history depth
    })),
  back: () => {
    const h = get().history;
    if (h.length === 0) {
      set({ view: { name: "dashboard" } });
      return;
    }
    const prev = h[h.length - 1];
    set({ view: prev, history: h.slice(0, -1) });
  },
  canGoBack: () => get().history.length > 0,
  storeOpenQuickToggle: true,
  setStoreOpenQuickToggle: (storeOpenQuickToggle) => set({ storeOpenQuickToggle }),
  productsStockFilter: "all",
  setProductsStockFilter: (productsStockFilter) => set({ productsStockFilter }),
}));

// Sync view with URL hash for refresh-safe navigation
function viewToHash(view: AdminView): string {
  const parts = [`v=${encodeURIComponent(view.name)}`];
  if (view.name === "product-edit" && view.id) parts.push(`id=${encodeURIComponent(view.id)}`);
  if (view.name === "order-detail") parts.push(`id=${encodeURIComponent(view.id)}`);
  if (view.name === "prescription-detail") parts.push(`id=${encodeURIComponent(view.id)}`);
  if (view.name === "manual-request-detail") parts.push(`id=${encodeURIComponent(view.id)}`);
  if (view.name === "customer-detail") parts.push(`id=${encodeURIComponent(view.id)}`);
  if (view.name === "settings" && view.section) parts.push(`section=${encodeURIComponent(view.section)}`);
  return parts.join("&");
}

function hashToView(hash: string): AdminView {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const name = params.get("v") as AdminView["name"] | null;
  if (!name) return { name: "dashboard" };
  if (name === "product-edit") return { name: "product-edit", id: params.get("id") || undefined };
  if (name === "order-detail") return { name: "order-detail", id: params.get("id") || "" };
  if (name === "prescription-detail") return { name: "prescription-detail", id: params.get("id") || "" };
  if (name === "manual-request-detail") return { name: "manual-request-detail", id: params.get("id") || "" };
  if (name === "customer-detail") return { name: "customer-detail", id: params.get("id") || "" };
  if (name === "settings") return { name: "settings", section: params.get("section") || undefined };
  return { name } as AdminView;
}

if (typeof window !== "undefined") {
  if (!(window as any).__pmsAdminPopState) {
    (window as any).__pmsAdminPopState = true;
    // Restore from hash on load
    const hash = window.location.hash;
    if (hash) {
      const view = hashToView(hash);
      useAdminStore.setState({ view });
    }
    // Push hash on navigate — wrap the original navigate
    const origNavigate = useAdminStore.getState().navigate;
    useAdminStore.setState({
      navigate: (view) => {
        origNavigate(view);
        window.history.pushState({}, "", "#" + viewToHash(view));
      },
    });
    // Listen for back/forward
    window.addEventListener("popstate", () => {
      const view = hashToView(window.location.hash);
      useAdminStore.setState({ view });
    });
  }
}
