// ============================================================================
// File: src/components/customer/search-dialog.tsx
// Purpose: Smart search dialog with multi-section autocomplete — Products,
//          Categories, Brands — plus recent searches (localStorage) and
//          trending quick-pick chips. Supports keyboard navigation.
// Role: Triggered from the header search button (Cmd/Ctrl+K on desktop).
// ============================================================================

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, X, ArrowRight, Pill, Clock, TrendingUp, Tag, Building2, Trash2 } from "lucide-react";
import { useUI } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { api, Product, Category, Brand } from "./api";
import { ProductImage } from "@/components/shared/product-image";
import { formatCurrency } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const TRENDING_SEARCHES = ["Dolo 650", "Crocin", "Vitamin C", "Insulin", "Sanitizer"];
const RECENT_KEY = "pms_recent_searches";
const MAX_RECENT = 5;

// ---------------------------------------------------------------------------
// localStorage recent searches — SSR-safe (reads only after mount).
// ---------------------------------------------------------------------------
function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeRecent(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Suggestion types — unified list for keyboard navigation.
// ---------------------------------------------------------------------------
type Suggestion =
  | { kind: "product"; product: Product }
  | { kind: "category"; category: Category }
  | { kind: "brand"; brand: Brand };

export function SearchDialog() {
  const searchOpen = useUI((s) => s.searchOpen);
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const navigate = useUI((s) => s.navigate);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened; clear query + recent reload on close
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setRecent(readRecent());
    } else {
      setQuery("");
      setDebounced("");
      setActiveIdx(-1);
    }
  }, [searchOpen]);

  // Cmd/Ctrl+K shortcut + ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  // Debounce the query (300ms) so we don't fire on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Single query for products — fires only when debounced query has >= 2 chars.
  const { data: productData, isFetching } = useQuery({
    queryKey: ["customer", "search", debounced],
    queryFn: () =>
      api<{ items: Product[] }>(
        `/api/catalog/products?query=${encodeURIComponent(debounced)}&limit=8`
      ),
    enabled: debounced.length >= 2 && searchOpen,
    staleTime: 30 * 1000,
  });

  // Categories + brands suggestions — fetched once per query (cached).
  // We fetch all public categories/brands (cached at the API) and filter
  // client-side — these lists are small and the API caches for 60s/300s.
  const { data: catsData } = useQuery({
    queryKey: ["customer", "search-cats"],
    queryFn: () => api<Category[]>("/api/catalog/categories"),
    enabled: debounced.length >= 2 && searchOpen,
    staleTime: 60 * 1000,
  });

  const { data: brandsData } = useQuery({
    queryKey: ["customer", "search-brands"],
    queryFn: () => api<Brand[]>("/api/catalog/brands"),
    enabled: debounced.length >= 2 && searchOpen,
    staleTime: 60 * 1000,
  });

  // Filter categories/brands client-side by the debounced query (<= 4 each).
  const categories = useMemo(() => {
    const all = catsData ?? [];
    if (!debounced) return [];
    const q = debounced.toLowerCase();
    return all.filter((c) => c.name?.toLowerCase().includes(q)).slice(0, 4);
  }, [catsData, debounced]);

  const brands = useMemo(() => {
    const all = brandsData ?? [];
    if (!debounced) return [];
    const q = debounced.toLowerCase();
    return all.filter((b) => b.name?.toLowerCase().includes(q)).slice(0, 4);
  }, [brandsData, debounced]);

  const products = productData?.items ?? [];

  // Build a flat list of suggestions (for keyboard nav + counting).
  const suggestions: Suggestion[] = useMemo(() => {
    const list: Suggestion[] = [];
    for (const p of products) list.push({ kind: "product", product: p });
    for (const c of categories) list.push({ kind: "category", category: c });
    for (const b of brands) list.push({ kind: "brand", brand: b });
    return list;
  }, [products, categories, brands]);

  const hasQuery = debounced.length >= 2;

  // Save a search term to recent searches (deduped, most-recent first).
  const saveRecent = useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...readRecent().filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
    writeRecent(next);
    setRecent(next);
  }, []);

  const submitSearch = (term?: string) => {
    const q = (term ?? query).trim();
    if (!q) return;
    saveRecent(q);
    setSearchOpen(false);
    navigate({ name: "shop", query: q });
  };

  const goProduct = (p: Product) => {
    saveRecent(query.trim() || p.name);
    setSearchOpen(false);
    navigate({ name: "product", productId: p.id, slug: p.slug });
  };

  const goCategory = (c: Category) => {
    saveRecent(query.trim() || c.name);
    setSearchOpen(false);
    navigate({ name: "shop", categoryId: c.id });
  };

  const goBrand = (b: Brand) => {
    saveRecent(query.trim() || b.name);
    setSearchOpen(false);
    navigate({ name: "shop", brandId: b.id });
  };

  // Keyboard navigation — arrow up/down to move activeIdx, Enter to activate.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (hasQuery && activeIdx >= 0 && activeIdx < suggestions.length) {
        const s = suggestions[activeIdx];
        if (s.kind === "product") goProduct(s.product);
        else if (s.kind === "category") goCategory(s.category);
        else goBrand(s.brand);
      } else {
        submitSearch();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
      return;
    }
    if (e.key === "Tab" && hasQuery && suggestions.length > 0) {
      // Reset activeIdx on Tab so user can re-navigate
      setActiveIdx(-1);
    }
  };

  // Reset activeIdx whenever the suggestion set changes
  useEffect(() => {
    setActiveIdx(-1);
  }, [debounced]);

  const removeRecent = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = recent.filter((s) => s !== term);
    writeRecent(next);
    setRecent(next);
  };

  const clearRecent = () => {
    writeRecent([]);
    setRecent([]);
  };

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent
        className="top-[10%] max-w-xl translate-y-0 gap-0 p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search products</DialogTitle>
          <DialogDescription>
            Find medicines, brands, categories and compositions.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="size-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search medicines, brands, compositions..."
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          {isFetching && (
            <span className="mr-1 inline-block size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          )}
          <kbd className="hidden rounded border bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ESC
          </kbd>
          <button
            onClick={() => setSearchOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close search"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Results */}
        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
          {!hasQuery ? (
            // No query: show recent + trending
            <div className="space-y-4 py-2">
              {/* Recent searches */}
              {recent.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between px-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Clock className="size-3.5" /> Recent searches
                    </span>
                    <button
                      onClick={clearRecent}
                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" /> Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-2">
                    {recent.map((term) => (
                      <button
                        key={term}
                        onClick={() => submitSearch(term)}
                        className="group flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:bg-accent"
                      >
                        <Clock className="size-3 text-muted-foreground" />
                        {term}
                        <span
                          onClick={(e) => removeRecent(term, e)}
                          className="ml-0.5 hidden text-muted-foreground hover:text-destructive group-hover:inline-flex"
                          aria-label={`Remove ${term}`}
                        >
                          <X className="size-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending searches */}
              <div>
                <div className="mb-2 px-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <TrendingUp className="size-3.5 text-emerald-500" /> Trending searches
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 px-2">
                  {TRENDING_SEARCHES.map((term) => (
                    <button
                      key={term}
                      onClick={() => submitSearch(term)}
                      className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                    >
                      <TrendingUp className="size-3" />
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hint when no recent */}
              {recent.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
                  <Pill className="mb-2 size-8 text-primary" />
                  Search for medicines, brands or compositions.
                  <br />
                  Try &quot;paracetamol&quot;, &quot;Dolo&quot;, or &quot;vitamin&quot;.
                </div>
              )}
            </div>
          ) : isFetching && products.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Searching...</div>
          ) : suggestions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No products found for &quot;{debounced}&quot;.
              <br />
              Try a different keyword or{" "}
              <button
                onClick={() => {
                  setSearchOpen(false);
                  navigate({ name: "manual-request" });
                }}
                className="text-primary underline"
              >
                request medicines manually
              </button>
              .
            </div>
          ) : (
            <div className="space-y-3">
              {/* Products section */}
              {products.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between px-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Pill className="size-3.5 text-emerald-600" /> Products
                    </span>
                    <span className="text-[10px] text-muted-foreground">{products.length} matches</span>
                  </div>
                  <div className="space-y-0.5">
                    <AnimatePresence initial={false}>
                      {products.map((p, i) => {
                        const idx = i;
                        const active = activeIdx === idx;
                        return (
                          <motion.button
                            key={p.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            onClick={() => goProduct(p)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={`flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors ${
                              active ? "bg-accent ring-1 ring-primary/30" : "hover:bg-accent"
                            }`}
                          >
                            <ProductImage
                              name={p.name}
                              brandName={p.brand?.name}
                              primaryImage={p.primaryImage}
                              size="sm"
                              className="!h-11 !w-11 rounded-md !text-base"
                            />
                            <div className="flex flex-1 flex-col overflow-hidden">
                              <span className="truncate text-sm font-medium">{p.name}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {p.brand?.name}
                                {p.composition ? ` • ${p.composition}` : ""}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold">{formatCurrency(p.sellingPrice)}</div>
                              {p.mrp > p.sellingPrice && (
                                <div className="text-[10px] text-muted-foreground line-through">
                                  {formatCurrency(p.mrp)}
                                </div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Categories section */}
              {categories.length > 0 && (
                <div>
                  <div className="mb-1 px-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Tag className="size-3.5 text-teal-600" /> Categories
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {categories.map((c, i) => {
                      const idx = products.length + i;
                      const active = activeIdx === idx;
                      return (
                        <button
                          key={c.id}
                          onClick={() => goCategory(c)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={`flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors ${
                            active ? "bg-accent ring-1 ring-primary/30" : "hover:bg-accent"
                          }`}
                        >
                          <div className="flex size-9 items-center justify-center rounded-md bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400">
                            <Tag className="size-4" />
                          </div>
                          <div className="flex flex-1 flex-col">
                            <span className="text-sm font-medium">{c.name}</span>
                            <span className="text-[11px] text-muted-foreground">Browse category</span>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Brands section */}
              {brands.length > 0 && (
                <div>
                  <div className="mb-1 px-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Building2 className="size-3.5 text-amber-600" /> Brands
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {brands.map((b, i) => {
                      const idx = products.length + categories.length + i;
                      const active = activeIdx === idx;
                      return (
                        <button
                          key={b.id}
                          onClick={() => goBrand(b)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={`flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors ${
                            active ? "bg-accent ring-1 ring-primary/30" : "hover:bg-accent"
                          }`}
                        >
                          <div className="flex size-9 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                            <Building2 className="size-4" />
                          </div>
                          <div className="flex flex-1 flex-col">
                            <span className="text-sm font-medium">{b.name}</span>
                            <span className="text-[11px] text-muted-foreground">Browse brand</span>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View all results */}
              <button
                onClick={() => submitSearch()}
                onMouseEnter={() => setActiveIdx(-1)}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 p-2 text-sm font-medium text-primary hover:bg-accent"
              >
                View all results for &quot;{debounced}&quot; <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {hasQuery && suggestions.length > 0 && (
          <div className="border-t bg-accent/40 px-4 py-2 text-[10px] text-muted-foreground">
            <span className="mr-3">
              <kbd className="rounded border bg-background px-1 py-0.5">↑↓</kbd> navigate
            </span>
            <span className="mr-3">
              <kbd className="rounded border bg-background px-1 py-0.5">↵</kbd> select
            </span>
            <span>
              <kbd className="rounded border bg-background px-1 py-0.5">esc</kbd> close
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
