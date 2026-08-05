// ============================================================================
// File: src/components/customer/use-recently-viewed.ts
// Purpose: Client-side hook that tracks the last 8 products the customer
//          viewed (in product detail), persisted to localStorage. Provides
//          the list + an add() method. Used to render a "Recently viewed"
//          section on the home page — a premium e-commerce UX touch.
// Role: Pure client state, no backend. Survives page reloads.
// ============================================================================

"use client";

import { useEffect, useState, useCallback } from "react";

const KEY = "pms_recently_viewed";
const MAX = 8;

export interface RecentProduct {
  id: string;
  name: string;
  slug: string;
  sellingPrice: number;
  mrp: number;
  primaryImage?: string | null;
  brandName?: string | null;
  viewedAt: number;
}

function read(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentProduct[]) : [];
  } catch {
    return [];
  }
}

function write(items: RecentProduct[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // ignore quota errors
  }
}

/** Read the recent list. Always starts as [] (matching SSR) and hydrates
 *  from localStorage in a useEffect, so server-rendered HTML matches the
 *  client's first render — no hydration mismatch. */
export function useRecentlyViewed() {
  // Start empty on BOTH server and client first-render so they match.
  const [items, setItems] = useState<RecentProduct[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (client-only).
  useEffect(() => {
     
    setItems(read());
    setHydrated(true);
  }, []);

  // Re-sync from localStorage when the tab regains focus (only after hydration).
  useEffect(() => {
    if (!hydrated) return;
    const onFocus = () => setItems(read());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hydrated]);

  return items;
}

/** Add a product to the recent list (dedupes + moves to front). */
export function useAddRecentlyViewed() {
  return useCallback((p: Omit<RecentProduct, "viewedAt">) => {
    const next = read().filter((i) => i.id !== p.id);
    next.unshift({ ...p, viewedAt: Date.now() });
    write(next);
  }, []);
}

/** Clear all recently viewed products. Returns a function that empties the list
 *  and removes it from localStorage. */
export function useClearRecentlyViewed() {
  return useCallback(() => {
    write([]);
  }, []);
}
