// ============================================================================
// File: src/components/customer/use-compare.ts
// Purpose: Client-side hook that tracks up to 4 products the customer has
//          added to the comparison tray. Persisted to localStorage so the
//          comparison survives page reloads. Provides add/remove/clear/toggle
//          methods + the current list.
// Role: Pure client state, no backend. Powers the Compare tray + Compare page.
// ============================================================================

"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

const KEY = "pms_compare_list";
const MAX = 4;

export interface CompareProduct {
  id: string;
  name: string;
  slug: string;
  sellingPrice: number;
  mrp: number;
  primaryImage?: string | null;
  brandName?: string | null;
  prescriptionRequired?: boolean;
  // Optional richer fields used by the enhanced compare view. Older callers
  // (e.g. compare-bar) don't always supply these — they're optional so the
  // compare tray remains backwards-compatible.
  stock?: number;
  composition?: string | null;
}

function read(): CompareProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CompareProduct[]) : [];
  } catch {
    return [];
  }
}

function write(items: CompareProduct[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // ignore quota errors
  }
}

// useSyncExternalStore for a stable mounted check (avoids hydration mismatch
// — the compare tray must not render during SSR).
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Hook for the comparison tray. Returns the list + mutation helpers.
 *  Always starts as [] (matching SSR) and hydrates from localStorage in a
 *  useEffect, so server-rendered HTML matches the client's first render. */
export function useCompare() {
  const mounted = useMounted();
  const [items, setItems] = useState<CompareProduct[]>([]);

  useEffect(() => {
     
    if (mounted) setItems(read());
  }, [mounted]);

  const add = useCallback((p: CompareProduct) => {
    setItems((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev; // already in compare
      if (prev.length >= MAX) {
        return prev; // full — caller should toast
      }
      const next = [...prev, p];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems(() => {
      write([]);
      return [];
    });
  }, []);

  const toggle = useCallback((p: CompareProduct) => {
    setItems((prev) => {
      if (prev.some((x) => x.id === p.id)) {
        const next = prev.filter((x) => x.id !== p.id);
        write(next);
        return next;
      }
      if (prev.length >= MAX) return prev; // full
      const next = [...prev, p];
      write(next);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => items.some((x) => x.id === id), [items]);

  return {
    items,
    add,
    remove,
    clear,
    toggle,
    has,
    isFull: items.length >= MAX,
    count: items.length,
    mounted,
  };
}
