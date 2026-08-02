// ============================================================================
// File: src/components/customer/medical-bundles-section.tsx
// Purpose: Premium horizontal-scroll carousel that showcases the curated
//          medical bundles on the home page (placed after "Trending Now").
//          Each bundle is a custom card with a gradient header, multi-product
//          thumbnails strip, "Add all to cart" CTA, total price + savings.
//
// Role: Replaces a random "more products" strip with medically meaningful
//       kits (First Aid, Diabetes Care, etc.). The customer can tap "View
//       All Health Bundles" to navigate to the dedicated /bundles view.
//
// Palette: emerald / teal / amber / rose — NO indigo or blue.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, MedicalBundleResponse, BundlesResponse, Product } from "./api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/shared/product-image";
import { useUI } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Package,
  Activity,
  HeartPulse,
  Baby,
  Thermometer,
  Pill,
  Eye,
  Droplet,
  Bone,
  ShoppingCart,
  Loader2,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";

// Map the bundle icon string (from MEDICAL_BUNDLES config) to a Lucide
// component. Centralized here so the bundle config stays a plain data file.
const BUNDLE_ICONS: Record<string, LucideIcon> = {
  Package,
  Activity,
  HeartPulse,
  Baby,
  Thermometer,
  Pill,
  Eye,
  Droplet,
  Bone,
};

function resolveBundleIcon(name?: string): LucideIcon {
  if (!name) return Package;
  return BUNDLE_ICONS[name] ?? Package;
}

/** Renders a bundle's Lucide icon by name. Uses createElement rather than
 *  JSX <Icon /> to satisfy the react-hooks/static-components lint rule
 *  (the icon reference is a runtime lookup, not a static component def). */
function BundleIcon({
  name,
  className,
  strokeWidth,
}: {
  name?: string;
  className?: string;
  strokeWidth?: number;
}) {
  return createElement(resolveBundleIcon(name), { className, strokeWidth });
}

/** Skeleton placeholders rendered while the bundles query is loading — so the
 *  section doesn't pop in and cause layout shift. */
function BundleCardSkeleton() {
  return (
    <div className="w-[300px] shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-premium-sm sm:w-[340px]">
      <div className="h-24 skeleton-premium" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 skeleton-premium rounded" />
        <div className="flex gap-2">
          <div className="size-14 skeleton-premium rounded-md" />
          <div className="size-14 skeleton-premium rounded-md" />
          <div className="size-14 skeleton-premium rounded-md" />
        </div>
        <div className="h-8 skeleton-premium rounded" />
      </div>
    </div>
  );
}

/** A single medical bundle card — gradient header, thumbnails, price + CTA. */
function BundleCard({ bundle }: { bundle: MedicalBundleResponse }) {
  const qc = useQueryClient();
  const navigate = useUI((s) => s.navigate);
  const thumbnailProducts = bundle.products.slice(0, 4);
  const remainingCount = Math.max(0, bundle.products.length - 4);

  const allInStock = bundle.inStockCount === bundle.products.length;
  const partialStock = bundle.inStockCount > 0 && !allInStock;

  // Add all products to cart sequentially — same pattern as the existing
  // addBundleMutation in product-view.tsx.
  const addBundleMutation = useMutation({
    mutationFn: async (products: Product[]) => {
      for (const p of products) {
        await api.post("/api/cart/add", { productId: p.id, qty: 1 });
      }
    },
    onSuccess: (_data, products) => {
      qc.invalidateQueries({ queryKey: qk.cart });
      toast.success(`Added ${products.length} items to cart`, {
        description: `${bundle.name} added — review your cart to checkout.`,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onAddBundle = async () => {
    const me = qc.getQueryData<{ id: string } | null>(qk.me);
    if (!me) {
      toast.info("Please login to add items to your cart");
      navigate({ name: "auth", mode: "login" });
      return;
    }
    addBundleMutation.mutate(bundle.products);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="group flex w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-premium-sm transition-premium hover:border-emerald-200 hover:shadow-premium-lg sm:w-[340px]"
    >
      {/* Gradient header with icon + name + description */}
      <div
        className={`relative bg-gradient-to-br ${bundle.accentColor} p-4 text-white`}
      >
        {/* Decorative shine */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.45) 0%, transparent 50%)",
          }}
        />
        <div className="relative flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <BundleIcon name={bundle.icon} className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-tight">{bundle.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/85">
              {bundle.description}
            </p>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-2">
          <Badge className="bg-white/20 text-[10px] font-semibold text-white backdrop-blur-sm">
            {bundle.products.length} items
          </Badge>
          {bundle.totalSavings > 0 && (
            <Badge className="bg-amber-300/90 text-[10px] font-semibold text-amber-950 backdrop-blur-sm">
              <Sparkles className="mr-1 size-3" /> Save {formatCurrency(bundle.totalSavings)}
            </Badge>
          )}
        </div>
      </div>

      {/* Body — product thumbnails + price + CTA */}
      <div className={`flex flex-1 flex-col gap-3 bg-gradient-to-b ${bundle.accentBg} p-4`}>
        {/* Thumbnail strip */}
        <div className="grid grid-cols-4 gap-2">
          {thumbnailProducts.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                navigate({ name: "product", productId: p.id, slug: p.slug })
              }
              className="group/thumb relative aspect-square overflow-hidden rounded-md border bg-card transition-all hover:-translate-y-0.5 hover:shadow-sm"
              title={p.name}
              aria-label={`View ${p.name}`}
            >
              <ProductImage
                name={p.name}
                brandName={p.brand?.name}
                primaryImage={p.primaryImage}
                images={p.images}
                size="sm"
                className="!h-full !w-full !text-base"
              />
            </button>
          ))}
          {remainingCount > 0 && (
            <button
              onClick={() => navigate({ name: "bundles" })}
              className="flex aspect-square flex-col items-center justify-center rounded-md border border-dashed bg-card/60 text-xs font-semibold text-muted-foreground hover:bg-accent"
              aria-label={`View ${remainingCount} more items in this bundle`}
            >
              <span className="text-base font-bold text-foreground">+{remainingCount}</span>
              <span className="text-[9px]">more</span>
            </button>
          )}
        </div>

        {/* Bundle names preview */}
        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          {bundle.products.slice(0, 2).map((p) => (
            <p key={p.id} className="truncate">
              {p.name}
            </p>
          ))}
          {bundle.products.length > 2 && (
            <p className="text-[10px] italic">
              + {bundle.products.length - 2} more essentials
            </p>
          )}
        </div>

        {/* Spacer pushes price + CTA to the bottom */}
        <div className="flex-1" />

        {/* Price + Add to cart */}
        <div className="mt-1 flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Bundle price
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(bundle.combinedPrice)}
              </span>
              {bundle.combinedMrp > bundle.combinedPrice && (
                <span className="text-[11px] text-muted-foreground line-through">
                  {formatCurrency(bundle.combinedMrp)}
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={onAddBundle}
            disabled={addBundleMutation.isPending || bundle.inStockCount === 0}
            className="btn-premium gap-1.5 shadow-premium-sm"
          >
            {addBundleMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShoppingCart className="size-3.5" />
            )}
            Add all
          </Button>
        </div>

        {/* Stock indicator */}
        {bundle.inStockCount === 0 ? (
          <p className="text-[10px] text-destructive">All items out of stock</p>
        ) : partialStock ? (
          <p className="text-[10px] text-amber-600">
            {bundle.inStockCount} of {bundle.products.length} items in stock
          </p>
        ) : (
          <p className="text-[10px] text-emerald-600">All items in stock</p>
        )}
      </div>
    </motion.div>
  );
}

/** Public home-page section: horizontal carousel of medical bundles. */
export function MedicalBundlesSection() {
  const navigate = useUI((s) => s.navigate);
  const { data, isLoading } = useQuery({
    queryKey: qk.bundles,
    queryFn: () => api<BundlesResponse>("/api/catalog/bundles"),
  });

  const bundles = data?.bundles ?? [];

  // Don't render the section at all if there are no bundles (e.g. empty catalog
  // or every bundle has 0 matching products). Loading state still renders so
  // the section doesn't pop in.
  if (!isLoading && bundles.length === 0) return null;

  return (
    <section>
      <div className="section-header-premium">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Package className="size-5" />
          </div>
          <div>
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
              Curated health kits
            </p>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Medical Bundles
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Medically relevant kits — save more when you buy together.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ name: "bundles" })}
          className="btn-premium group gap-1 font-semibold text-primary hover:bg-primary/5"
        >
          View all <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <BundleCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {bundles.map((b) => (
            <BundleCard key={b.id} bundle={b} />
          ))}
        </div>
      )}
    </section>
  );
}
