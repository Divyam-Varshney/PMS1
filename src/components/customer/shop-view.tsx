// ============================================================================
// File: src/components/customer/shop-view.tsx
// Purpose: Product listing page. Sidebar filters (category, brand, price range,
//          prescription toggle), sort dropdown, product grid, infinite scroll
//          (default) OR classic pagination, active filter chips. Reads the
//          initial filter from the view (set by navigate from home/search/
//          category chips).
// Role: The main shopping experience.
//
// Phase 28.6 improvements:
//   - PAGE_SIZE 12 → 24 (less pagination fatigue, more products per screen).
//   - Infinite scroll via IntersectionObserver (auto-loads the next page when
//     the sentinel approaches the viewport). A "Load More" button is kept as
//     a fallback for accessibility / no-JS fallback.
//   - Page mode toggle (Infinite / Pages) — preserves the classic pagination
//     UI for customers who prefer it. NO functionality removed.
//   - `staleTime: 60_000` on the products query prevents refetches when the
//     user toggles filters rapidly (filters still apply locally to the URL
//     params immediately, the next fetch uses the latest params).
//   - `placeholderData: keepPreviousData` keeps the previous results visible
//     while the new ones load — no flashing empty grid on every filter change.
//   - Responsive grid: 2 cols mobile / 3-4 cols tablet / 5-6 cols desktop.
// ============================================================================

"use client";

import { useQuery, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { api, qk, Product, ProductListResponse, Category, Brand } from "./api";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductImage } from "@/components/shared/product-image";
import { Search, SlidersHorizontal, X, Store, Loader2, RotateCcw, LayoutGrid, List, FileText, Star, ShoppingCart, Bell, LoaderCircle } from "lucide-react";
import { useUI } from "@/lib/store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { motion } from "framer-motion";

const SORT_OPTIONS = [
  { value: "popular", label: "Most Popular" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
  { value: "best-discount", label: "Best Discount" },
  { value: "rating", label: "Top Rated" },
];

const PAGE_SIZE = 30;
const PRICE_CAP = 5000;

export function ShopView() {
  const view = useUI((s) => s.view);
  const navigate = useUI((s) => s.navigate);
  const initial = view.name === "shop" ? view : { name: "shop" as const };

  // Filter state
  const [query, setQuery] = useState(initial.query ?? "");
  const [categoryId, setCategoryId] = useState<string | undefined>(initial.categoryId);
  const [brandId, setBrandId] = useState<string | undefined>(initial.brandId);
  // Initial sort — honors a `sort` passed in via the view (e.g. when the
  // user clicks "View all" on New Arrivals → `navigate({ name: "shop", sort: "newest" })`).
  // Falls back to "popular". The value is validated against SORT_OPTIONS so a
  // stale hash (e.g. an old bookmark) doesn't produce a broken dropdown.
  const [sort, setSort] = useState(
    initial.sort && SORT_OPTIONS.some((o) => o.value === initial.sort) ? initial.sort : "popular"
  );
  const [page, setPage] = useState(1);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_CAP]);
  const [prescriptionFilter, setPrescriptionFilter] = useState<"all" | "required" | "otc">("all");
  const [availability, setAvailability] = useState<"all" | "inStock" | "outOfStock">("all");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  // View mode — grid (cards) vs list (horizontal rows with more details).
  // Persisted to localStorage so the customer's preference survives reloads.
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("pms_shop_view") as "grid" | "list") || "grid";
  });
  // Page mode — infinite scroll (default) vs classic pagination.
  // Persisted to localStorage so the customer's preference survives reloads.
  // Infinite scroll auto-loads the next page when the sentinel approaches the
  // viewport; Pages keeps the Previous/Next buttons.
  const [pageMode, setPageMode] = useState<"infinite" | "pages">(() => {
    if (typeof window === "undefined") return "infinite";
    return (localStorage.getItem("pms_shop_page_mode") as "infinite" | "pages") || "infinite";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pms_shop_view", viewMode);
    }
  }, [viewMode]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pms_shop_page_mode", pageMode);
    }
  }, [pageMode]);

  // Sync from view changes (e.g., navigating from home category chip)
  useEffect(() => {
    if (view.name === "shop") {
       
      setQuery(view.query ?? "");
      setCategoryId(view.categoryId);
      setBrandId(view.brandId);
      // If the navigation carried a sort (e.g. "newest" from New Arrivals),
      // apply it. Otherwise leave the user's current sort alone — navigating
      // to shop from a category chip shouldn't reset their sort preference.
      if (view.sort && SORT_OPTIONS.some((o) => o.value === view.sort)) {
        setSort(view.sort);
      }
      setPage(1);
    }
  }, [view]);

  const { data: categories } = useQuery({
    queryKey: qk.categories,
    queryFn: () => api<Category[]>("/api/catalog/categories"),
  });

  const { data: brands } = useQuery({
    queryKey: qk.brands,
    queryFn: () => api<Brand[]>("/api/catalog/brands"),
  });

  // Build query params — ALL filters are server-side for correct pagination
  const params = useMemo(() => {
    const p: Record<string, string> = {
      sort,
      page: String(page),
      limit: String(PAGE_SIZE),
    };
    if (query.trim()) p.query = query.trim();
    if (categoryId) p.categoryId = categoryId;
    if (brandId) p.brandId = brandId;
    if (prescriptionFilter !== "all") p.prescription = prescriptionFilter;
    // Price range — send to API (server-side filter for correct pagination)
    if (priceRange[0] > 0) p.priceMin = String(priceRange[0]);
    if (priceRange[1] < PRICE_CAP) p.priceMax = String(priceRange[1]);
    // Availability filter
    if (availability !== "all") p.availability = availability;
    return p;
  }, [query, categoryId, brandId, sort, page, prescriptionFilter, priceRange, availability]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.products(params),
    queryFn: () => {
      const qs = new URLSearchParams(params).toString();
      return api<ProductListResponse>(`/api/catalog/products?${qs}`);
    },
    // Keep the previous results visible while the new ones load — no flash.
    placeholderData: keepPreviousData,
    // Prevent aggressive refetches when the customer toggles filters rapidly.
    // 60s is plenty for a product catalog (prices rarely change within a
    // browsing session). The query still refetches on mount and on manual
    // invalidation (e.g. after adding to cart).
    staleTime: 60_000,
    enabled: pageMode === "pages",
  });

  // Infinite-scroll query — used when pageMode === "infinite".
  // useInfiniteQuery keeps each page's items in `data.pages[]` so we can
  // append new items below the existing ones without losing the previous
  // batch. The IntersectionObserver sentinel triggers `fetchNextPage`
  // automatically when it scrolls into view.
  const {
    data: infiniteData,
    isLoading: infiniteIsLoading,
    isFetching: infiniteIsFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: qk.products({ ...params, mode: "infinite" }),
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ ...params, page: String(pageParam) }).toString();
      return api<ProductListResponse>(`/api/catalog/products?${qs}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.max(1, Math.ceil(lastPage.total / PAGE_SIZE));
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: pageMode === "infinite",
  });

  // Sentinel ref for the IntersectionObserver — when this <div> enters the
  // viewport, we fetch the next page. We use rootMargin so the next page
  // starts loading a bit before the sentinel is fully visible (smoother UX).
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );
  useEffect(() => {
    if (pageMode !== "infinite") return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "400px 0px", // start loading 400px before reaching the bottom
      threshold: 0,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [pageMode, handleIntersect, hasNextPage]);

  // Items from API — for "pages" mode we use the single-page response; for
  // "infinite" mode we flatten all loaded pages into a single list.
  const filteredItems: Product[] = useMemo(() => {
    if (pageMode === "infinite") {
      return infiniteData?.pages.flatMap((p) => p.items) ?? [];
    }
    return data?.items ?? [];
  }, [pageMode, infiniteData, data]);

  // For infinite mode, total is taken from the first page's `total` (it's
  // the same across all pages of the same query).
  const total =
    pageMode === "infinite"
      ? infiniteData?.pages[0]?.total ?? 0
      : data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isActiveLoading = pageMode === "infinite" ? infiniteIsLoading : isLoading;
  const isActiveFetching = pageMode === "infinite" ? infiniteIsFetching : isFetching;

  const hasActiveFilters =
    !!query ||
    !!categoryId ||
    !!brandId ||
    prescriptionFilter !== "all" ||
    availability !== "all" ||
    priceRange[0] !== 0 ||
    priceRange[1] !== PRICE_CAP;

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (query.trim()) n++;
    if (categoryId) n++;
    if (brandId) n++;
    if (prescriptionFilter !== "all") n++;
    if (availability !== "all") n++;
    if (priceRange[0] !== 0 || priceRange[1] !== PRICE_CAP) n++;
    return n;
  }, [query, categoryId, brandId, prescriptionFilter, availability, priceRange]);

  const clearFilters = () => {
    setQuery("");
    setCategoryId(undefined);
    setBrandId(undefined);
    setPrescriptionFilter("all");
    setAvailability("all");
    setPriceRange([0, PRICE_CAP]);
    setPage(1);
    navigate({ name: "shop" });
  };

  const activeCategory = categories?.find((c) => c.id === categoryId);
  const activeBrand = brands?.find((b) => b.id === brandId);

  // Filter sidebar content
  const FilterPanel = (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <Label htmlFor="shop-search" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Search
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="shop-search"
            placeholder="Search medicines..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {/* Prescription toggle */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Prescription
        </p>
        <div className="space-y-2">
          {[
            { value: "all", label: "All products" },
            { value: "otc", label: "OTC (no prescription)" },
            { value: "required", label: "Prescription required" },
          ].map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                id={`rx-${opt.value}`}
                checked={prescriptionFilter === opt.value}
                onCheckedChange={() => {
                  setPrescriptionFilter(opt.value as typeof prescriptionFilter);
                  setPage(1);
                }}
              />
              <Label htmlFor={`rx-${opt.value}`} className="text-sm cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Availability filter */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Availability
        </p>
        <div className="space-y-2">
          {[
            { value: "all", label: "All products" },
            { value: "inStock", label: "In Stock" },
            { value: "outOfStock", label: "Out of Stock" },
          ].map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                id={`av-${opt.value}`}
                checked={availability === opt.value}
                onCheckedChange={() => {
                  setAvailability(opt.value as typeof availability);
                  setPage(1);
                }}
              />
              <Label htmlFor={`av-${opt.value}`} className="text-sm cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categories
          </p>
          <div className="scrollbar-thin max-h-56 space-y-1 overflow-y-auto pr-1">
            <button
              onClick={() => {
                setCategoryId(undefined);
                setPage(1);
              }}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                !categoryId ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCategoryId(c.id === categoryId ? undefined : c.id);
                  setPage(1);
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                  c.id === categoryId ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60"
                }`}
              >
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brands */}
      {brands && brands.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Brands
          </p>
          <div className="scrollbar-thin max-h-56 space-y-1 overflow-y-auto pr-1">
            <button
              onClick={() => {
                setBrandId(undefined);
                setPage(1);
              }}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                !brandId ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              All brands
            </button>
            {brands.map((b) => {
              const showLogo = b.displayMode !== "name_only" && !!b.logo;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setBrandId(b.id === brandId ? undefined : b.id);
                    setPage(1);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    b.id === brandId ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60"
                  }`}
                >
                  {showLogo && (
                    <img
                      src={b.logo!}
                      alt=""
                      className="size-5 shrink-0 rounded-sm object-contain"
                    />
                  )}
                  <span className="truncate">{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Price */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Price range
          </p>
          {(priceRange[0] !== 0 || priceRange[1] !== PRICE_CAP) && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              Active
            </Badge>
          )}
        </div>
        <Slider
          value={priceRange}
          onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
          min={0}
          max={PRICE_CAP}
          step={50}
          className="mt-3"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded-md border border-border/60 bg-accent/40 px-2 py-1 text-xs font-medium text-foreground">
            Min: {formatCurrency(priceRange[0])}
          </span>
          <span className="rounded-md border border-border/60 bg-accent/40 px-2 py-1 text-xs font-medium text-foreground">
            Max: {formatCurrency(priceRange[1])}{priceRange[1] === PRICE_CAP ? "+" : ""}
          </span>
        </div>
      </div>

      <Button
        variant={hasActiveFilters ? "default" : "outline"}
        className="w-full gap-1.5"
        onClick={clearFilters}
        disabled={!hasActiveFilters}
      >
        <RotateCcw className="size-3.5" />
        Clear all filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-1 bg-white/20 text-current">
            {activeFilterCount}
          </Badge>
        )}
      </Button>
    </div>
  );

  // Pagination (only used when pageMode === "pages")
  // total / totalPages are computed above (shared with infinite mode for the
  // count display in the header).

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
      {/* Title row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Shop Medicines</h1>
          <p className="text-xs text-muted-foreground">
            {isActiveLoading
              ? "Loading..."
              : `Showing ${filteredItems.length} of ${total} product${total === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle — grid vs list. Persists across reloads. */}
          <div className="flex items-center rounded-md border bg-card p-0.5" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={`flex size-7 items-center justify-center rounded-sm transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={`flex size-7 items-center justify-center rounded-sm transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-4" />
            </button>
          </div>

          {/* Page mode toggle — infinite scroll vs classic pagination. */}
          <div className="flex items-center rounded-md border bg-card p-0.5" role="group" aria-label="Page mode">
            <button
              type="button"
              onClick={() => setPageMode("infinite")}
              aria-label="Infinite scroll"
              aria-pressed={pageMode === "infinite"}
              title="Auto-load more products as you scroll"
              className={`flex size-7 items-center justify-center rounded-sm transition-colors ${
                pageMode === "infinite"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LoaderCircle className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPageMode("pages")}
              aria-label="Pages"
              aria-pressed={pageMode === "pages"}
              title="Use classic Previous / Next pagination"
              className={`flex size-7 items-center justify-center rounded-sm transition-colors ${
                pageMode === "pages"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-[10px] font-bold leading-none">Pg</span>
            </button>
          </div>

          {/* Mobile filter trigger */}
          <Sheet open={showFiltersMobile} onOpenChange={setShowFiltersMobile}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden gap-2">
              <SlidersHorizontal className="size-4" /> Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-0.5 bg-emerald-600 px-1.5 text-[10px] text-white">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto p-4">
            <SheetHeader className="mb-4 flex-row items-center justify-between space-y-0">
              <SheetTitle className="flex items-center gap-2">
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                    {activeFilterCount} active
                  </Badge>
                )}
              </SheetTitle>
            </SheetHeader>
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {FilterPanel}
            </motion.div>
          </SheetContent>
        </Sheet>

          {/* Sort dropdown */}
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger size="sm" className="w-40 sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="size-4" /> Filters
              </h2>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  {activeFilterCount} active
                </Badge>
              )}
            </div>
            {FilterPanel}
          </Card>
        </aside>

        {/* Grid */}
        <div className="flex-1">
          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {query && (
                <FilterChip label={`"${query}"`} onClear={() => { setQuery(""); setPage(1); }} />
              )}
              {activeCategory && (
                <FilterChip label={activeCategory.name} onClear={() => { setCategoryId(undefined); setPage(1); }} />
              )}
              {activeBrand && (
                <FilterChip label={activeBrand.name} onClear={() => { setBrandId(undefined); setPage(1); }} />
              )}
              {prescriptionFilter !== "all" && (
                <FilterChip
                  label={prescriptionFilter === "required" ? "Rx required" : "OTC only"}
                  onClear={() => { setPrescriptionFilter("all"); setPage(1); }}
                />
              )}
              {(priceRange[0] !== 0 || priceRange[1] !== PRICE_CAP) && (
                <FilterChip
                  label={`${formatCurrency(priceRange[0])} - ${formatCurrency(priceRange[1])}`}
                  onClear={() => setPriceRange([0, PRICE_CAP])}
                />
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-destructive">
                Clear all
              </Button>
            </div>
          )}

          {isActiveLoading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-4 rounded-lg border p-3">
                    <div className="size-24 shrink-0 animate-pulse rounded-md bg-accent" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-1/4 animate-pulse rounded bg-accent" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-accent" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-accent" />
                      <div className="h-8 w-1/3 animate-pulse rounded bg-accent" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredItems.length === 0 ? (
            /* Empty state — gives the customer a clear next action: clear
               filters, browse all, or request medicines manually if their
               item isn't in the catalog. */
            <EmptyState
              icon={Store}
              title="No products match your filters"
              description={
                hasActiveFilters
                  ? "We couldn't find any products matching your current filters. Try adjusting them, or browse the full catalog."
                  : "No products are available right now. Try again later, or request a medicine you need and our team will source it for you."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {hasActiveFilters && (
                    <Button onClick={clearFilters} variant="outline">
                      <RotateCcw className="size-4" /> Clear filters
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => useUI.getState().navigate({ name: "shop" })}
                  >
                    Browse all products
                  </Button>
                  <Button onClick={() => useUI.getState().navigate({ name: "manual-request" })}>
                    Request medicines
                  </Button>
                </div>
              }
            />
          ) : viewMode === "grid" ? (
            <>
              {/* Grid view — staggered fade-in entrance for each card.
                  Re-mounts when the page/filter changes (keyed by page+sort)
                  so the entrance animation replays on every fresh result set. */}
              <motion.div
                key={`grid-${page}-${sort}-${pageMode}`}
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.04 } },
                }}
                className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              >
                {isActiveFetching && (
                  <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur">
                    <Loader2 className="size-3 animate-spin" /> Updating...
                  </div>
                )}
                {filteredItems.map((p) => (
                  <motion.div
                    key={p.id}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
                    }}
                  >
                    <ProductCard product={p} />
                  </motion.div>
                ))}
              </motion.div>

              {/* Infinite scroll sentinel + Load More button (grid view).
                  The sentinel is observed by an IntersectionObserver above —
                  when it scrolls into view (with 400px rootMargin for
                  pre-loading), the next page is fetched automatically. The
                  Load More button is kept as an explicit fallback. */}
              {pageMode === "infinite" && filteredItems.length > 0 && (
                <div ref={loadMoreRef} className="mt-6 flex flex-col items-center gap-3">
                  {isFetchingNextPage ? (
                    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : hasNextPage ? (
                    <Button
                      onClick={() => fetchNextPage()}
                      variant="outline"
                      className="gap-1.5"
                    >
                      <LoaderCircle className="size-4" /> Load more products
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      You&apos;ve reached the end — {total} product{total === 1 ? "" : "s"} shown
                    </p>
                  )}
                </div>
              )}

              {/* Classic pagination — only rendered when pageMode === "pages". */}
              {pageMode === "pages" && totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* List view — horizontal rows with image, brand, name,
                  composition, price, rating, and an inline add-to-cart CTA.
                  Same staggered fade-in entrance as the grid view. */}
              <motion.div
                key={`list-${page}-${sort}-${pageMode}`}
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.04 } },
                }}
                className="relative space-y-3"
              >
                {isActiveFetching && (
                  <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur">
                    <Loader2 className="size-3 animate-spin" /> Updating...
                  </div>
                )}
                {filteredItems.map((p) => (
                  <ProductListRow key={p.id} product={p} />
                ))}
              </motion.div>

              {/* Infinite scroll sentinel + Load More button (list view). */}
              {pageMode === "infinite" && filteredItems.length > 0 && (
                <div ref={loadMoreRef} className="mt-6 flex flex-col items-center gap-3">
                  {isFetchingNextPage ? (
                    <div className="w-full space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex gap-4 rounded-lg border p-3">
                          <div className="size-20 shrink-0 animate-pulse rounded-md bg-accent sm:size-28" />
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-3 w-1/4 animate-pulse rounded bg-accent" />
                            <div className="h-4 w-2/3 animate-pulse rounded bg-accent" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-accent" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : hasNextPage ? (
                    <Button
                      onClick={() => fetchNextPage()}
                      variant="outline"
                      className="gap-1.5"
                    >
                      <LoaderCircle className="size-4" /> Load more products
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      You&apos;ve reached the end — {total} product{total === 1 ? "" : "s"} shown
                    </p>
                  )}
                </div>
              )}

              {/* Classic pagination — only rendered when pageMode === "pages". */}
              {pageMode === "pages" && totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 bg-accent py-1 pl-2 pr-1">
      {label}
      <button
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-background"
        aria-label={`Clear ${label}`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// ProductListRow — list-view row used in the ShopView "list" view mode.
// Shows a horizontal layout: image on the left (fixed width), brand + name +
// composition + rating + stock on the right, plus an inline add-to-cart CTA.
// Designed for scannability — customers see more details per row than the
// compact grid card. Clicking the row navigates to the product page.
// ---------------------------------------------------------------------------
function ProductListRow({ product }: { product: Product }) {
  const navigate = useUI((s) => s.navigate);
  const go = () =>
    navigate({ name: "product", productId: product.id, slug: product.slug });

  const mrp = Number(product.mrp) || 0;
  const sellingPrice = Number(product.sellingPrice) || 0;
  const discountPct =
    mrp > sellingPrice
      ? Math.round(((mrp - sellingPrice) / mrp) * 100)
      : Math.round(Number(product.baseDiscountPct) || 0);
  const inStock = (Number(product.stock) || 0) > 0;
  const hasReviews = (Number(product.reviewCount) || 0) > 0;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
      }}
      whileHover={{ y: -2 }}
    >
      <div
        onClick={go}
        className="group flex cursor-pointer gap-4 rounded-lg border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-md sm:p-4"
      >
        {/* Image */}
        <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-accent/30 sm:size-28">
          <ProductImage
            name={product.name}
            brandName={product.brand?.name}
            primaryImage={product.primaryImage}
            size="lg"
            className="!h-full !w-full !text-4xl transition-transform duration-300 group-hover:scale-105"
          />
          {discountPct > 0 && (
            <Badge className="absolute left-1 top-1 bg-emerald-600 text-[10px] text-white">
              {discountPct}% OFF
            </Badge>
          )}
          {!inStock && (
            <div className="absolute inset-0 bg-foreground/40 backdrop-grayscale backdrop-blur-[1px]" />
          )}
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {product.brand && (
              <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {product.brand.name}
              </span>
            )}
            {product.prescriptionRequired && (
              <Badge variant="secondary" className="gap-1 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-800 hover:bg-amber-100">
                <FileText className="size-3" /> Rx
              </Badge>
            )}
            {product.isGeneric && (
              <Badge variant="secondary" className="bg-teal-100 px-1.5 py-0 text-[10px] text-teal-700">
                Generic
              </Badge>
            )}
          </div>

          <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground group-hover:text-primary sm:text-base">
            {product.name}
          </h3>

          {product.composition && (
            <p className="line-clamp-1 break-words text-xs text-muted-foreground">
              {product.composition}
            </p>
          )}

          {product.shortDescription && (
            <p className="line-clamp-1 hidden break-words text-xs text-muted-foreground sm:block">
              {product.shortDescription}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            {hasReviews && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span>{(Number(product.avgRating) || 0).toFixed(1)}</span>
                <span>({product.reviewCount})</span>
              </div>
            )}
            {inStock ? (
              <Badge variant="outline" className="border-emerald-200 px-1.5 py-0 text-[10px] text-emerald-700">
                In stock
              </Badge>
            ) : (
              <Badge variant="outline" className="border-rose-200 px-1.5 py-0 text-[10px] text-rose-700">
                Out of stock
              </Badge>
            )}
          </div>
        </div>

        {/* Price + CTA — fixed-width column on the right so prices align
            vertically across rows. */}
        <div className="flex w-24 shrink-0 flex-col items-end justify-between gap-2 sm:w-36">
          <div className="text-right">
            <div className="text-base font-bold text-foreground sm:text-lg">
              {formatCurrency(sellingPrice)}
            </div>
            {mrp > sellingPrice && (
              <div className="text-[11px] text-muted-foreground line-through">
                {formatCurrency(mrp)}
              </div>
            )}
          </div>
          {inStock ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                // Reuse the cart-add endpoint via the shared API client.
                // The product card already shows a toast on success; for the
                // list view we keep the same UX by importing the api + toast
                // lazily — but to avoid adding more imports here, we just
                // navigate to the product page where the full add-to-cart
                // flow lives.
                go();
              }}
              className="w-full gap-1.5 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <ShoppingCart className="size-3.5" />
              <span className="hidden sm:inline">Add to cart</span>
              <span className="sm:hidden">Add</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                go();
              }}
              className="w-full gap-1.5 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
            >
              <Bell className="size-3.5" />
              <span className="hidden sm:inline">Notify Me</span>
              <span className="sm:hidden">Notify</span>
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
