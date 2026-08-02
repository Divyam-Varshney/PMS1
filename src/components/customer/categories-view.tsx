// ============================================================================
// File: src/components/customer/categories-view.tsx
// Purpose: Grid view of ALL product categories. Each tile shows the category
//          image (if set) or a gradient letter placeholder, the name, and the
//          product count. Includes a search bar to filter by name. Clicking a
//          tile navigates to the shop filtered by that category.
// Role: Dedicated "Shop by Category" landing page — linked from the homepage
//       "View All" button on the categories strip.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { api, qk, Category } from "./api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, ChevronLeft } from "lucide-react";
import { useUI } from "@/lib/store";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Predefined gradient palette — cycled by category index for visual variety.
// Each tile uses a different emerald/teal/cyan gradient so the grid feels
// vibrant but still on-brand.
// ---------------------------------------------------------------------------
const GRADIENTS = [
  "from-emerald-500 via-teal-500 to-cyan-600",
  "from-teal-500 via-emerald-500 to-green-600",
  "from-cyan-500 via-teal-500 to-emerald-600",
  "from-green-500 via-emerald-500 to-teal-600",
  "from-emerald-600 via-cyan-500 to-teal-600",
  "from-teal-600 via-cyan-500 to-emerald-500",
];

export function CategoriesView() {
  const navigate = useUI((s) => s.navigate);
  const [query, setQuery] = useState("");

  // Fetch the full list of categories (with product counts) from the public
  // catalog endpoint. The same query is used on the homepage strip, so the
  // result is cached across both views via the qk.categories key.
  const { data: categories, isLoading } = useQuery({
    queryKey: qk.categories,
    queryFn: () => api<Category[]>("/api/catalog/categories"),
  });

  // Client-side filter on the search box. Re-derived whenever the query or
  // the underlying categories list changes.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories ?? [];
    return (categories ?? []).filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header + back button */}
      <button
        onClick={() => navigate({ name: "home" })}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to home
      </button>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Shop by Category</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse our full range of medicines and wellness products by category.
          </p>
        </div>

        {/* Search bar — filters the grid in real time */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories..."
            className="pl-8"
            aria-label="Search categories"
          />
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        // Empty state — either no categories at all, or no matches for the query
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Package className="size-6" />
          </div>
          <div>
            <p className="font-semibold">No categories found</p>
            <p className="text-sm text-muted-foreground">
              {query ? `No matches for "${query}". Try a different search.` : "Categories will appear here once added."}
            </p>
          </div>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        // Category grid — 2 cols on mobile, 3 on tablet, 4-6 on desktop.
        // Staggered framer-motion entrance for a polished feel.
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {filtered.map((cat, idx) => (
            <CategoryTile
              key={cat.id}
              category={cat}
              gradient={GRADIENTS[idx % GRADIENTS.length]}
              onClick={() => navigate({ name: "shop", categoryId: cat.id })}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category tile — gradient letter placeholder OR image thumbnail.
// ---------------------------------------------------------------------------

function CategoryTile({
  category,
  gradient,
  onClick,
}: {
  category: Category;
  gradient: string;
  onClick: () => void;
}) {
  // First letter of the category name, uppercased — used for the placeholder
  // when no image is set. Falls back to "P" (for Pharmacy) for empty names.
  const initial = (category.name?.[0] || "P").toUpperCase();

  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
      }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-shadow hover:shadow-lg hover:shadow-emerald-200/40"
    >
      {/* Image / gradient header (aspect-[4/3] so all tiles line up) */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {category.image ? (
          <img
            src={category.image}
            alt={category.name}
            className="size-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className={`relative flex size-full items-center justify-center bg-gradient-to-br ${gradient}`}>
            {/* Subtle dotted texture overlay for a premium look */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            <span className="relative text-4xl font-black text-white drop-shadow">
              {initial}
            </span>
          </div>
        )}
        {/* Product count badge — bottom-left of the header, on top of the image */}
        <Badge className="absolute bottom-2 left-2 bg-white/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-white/90">
          <Package className="size-3" />
          {typeof category.productCount === "number"
            ? `${category.productCount} ${category.productCount === 1 ? "item" : "items"}`
            : "View"}
        </Badge>
      </div>

      {/* Body — name (clamped to 2 lines) */}
      <div className="flex flex-1 items-center p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground group-hover:text-emerald-700">
          {category.name}
        </h3>
      </div>
    </motion.button>
  );
}
