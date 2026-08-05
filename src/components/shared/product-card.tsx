// ============================================================================
// File: src/components/shared/product-card.tsx
// Purpose: Reusable product card used in HomeView, ShopView, related products,
//          search results. Shows image, name, brand, MRP strike + selling price,
//          discount %, prescription badge, add-to-cart button, wishlist heart,
//          compare toggle, and a quick-add button.
// Role: Single visual treatment for product tiles across the customer site.
// ============================================================================

"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  FileText,
  Star,
  Loader2,
  Plus,
  Zap,
  Bell,
  GitCompare,
  Sparkles,
  X,
} from "lucide-react";
import { useState, memo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  qk,
  Product,
  ProductRecommendationsResponse,
} from "@/components/customer/api";
import { useUI } from "@/lib/store";
import { useCompare } from "@/components/customer/use-compare";
import { ProductImage } from "./product-image";
import { WishlistButton } from "./wishlist-button";
import { ShareButton } from "./share-button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const { has, toggle, isFull, count } = useCompare();
  const [adding, setAdding] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inStock = (Number(product.stock) || 0) > 0;
  const inCompare = has(product.id);

  // Null-safe numeric access — wishlist/cache may return partial product objects.
  // baseDiscountPct is the admin-confirmed discount % the customer should see
  // (it auto-follows (MRP - Selling) / MRP * 100 by default; admin can override).
  const mrp = Number(product.mrp) || 0;
  const sellingPrice = Number(product.sellingPrice) || 0;
  const discountPct =
    mrp > sellingPrice
      ? Math.round(((mrp - sellingPrice) / mrp) * 100)
      : Math.round(Number(product.baseDiscountPct) || 0);

  const addToCartMutation = useMutation({
    mutationFn: () => api.post("/api/cart/add", { productId: product.id, qty: 1 }),
    onMutate: () => setAdding(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cart });
      toast.success("Added to cart", { description: product.name });
      // Fire-and-forget: fetch complementary products and show a
      // non-intrusive "Frequently bought together" suggestion toast.
      showRecommendationToast();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setAdding(false),
  });

  // Recommendation toast — uses the existing /api/catalog/recommendations/[productId]
  // endpoint (powered by src/lib/recommendation-engine.ts). Picks the top 2
  // complementary (frequentlyBought) items that are in stock and NOT the same
  // as the product just added. Shows a compact JSX toast with thumbnails +
  // "Add" buttons. Auto-dismisses after 6 seconds.
  //
  // Throttling: a ref tracks the timestamp of the last toast shown so we don't
  // spam the customer when they rapid-fire add multiple products. The toast is
  // suppressed for 8 seconds after each show.
  const lastToastAtRef = useRef(0);
  const addRecommendedMutation = useMutation({
    mutationFn: (productId: string) =>
      api.post("/api/cart/add", { productId, qty: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cart });
      toast.success("Added to cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const showRecommendationToast = async () => {
    // Throttle: at most one recommendation toast every 8 seconds.
    const now = Date.now();
    if (now - lastToastAtRef.current < 8000) return;
    lastToastAtRef.current = now;

    try {
      const recs = await api<ProductRecommendationsResponse>(
        `/api/catalog/recommendations/${encodeURIComponent(product.id)}`
      );
      const picks = (recs.frequentlyBought ?? [])
        .filter((p) => Number(p.stock) > 0 && p.id !== product.id)
        .slice(0, 2);
      if (picks.length === 0) {
        // Fallback to related if no complementary items exist.
        const relatedPicks = (recs.related ?? [])
          .filter((p) => Number(p.stock) > 0 && p.id !== product.id)
          .slice(0, 2);
        if (relatedPicks.length === 0) return;
        renderRecommendationToast(relatedPicks, "You might also like");
        return;
      }
      renderRecommendationToast(picks, "Frequently bought together");
    } catch {
      // Silently fail — recommendations are a nice-to-have, not critical.
    }
  };

  const renderRecommendationToast = (
    picks: Product[],
    heading: string
  ) => {
    const toastId = `rec-${product.id}-${Date.now()}`;
    toast.custom(
      (t) => (
        <div
          className="pointer-events-auto w-full max-w-sm rounded-xl border border-emerald-100 bg-white p-3 shadow-lg dark:border-emerald-900/40 dark:bg-card"
          data-testid="recommendation-toast"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/40">
              <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-foreground">
              {heading}
            </p>
            <button
              onClick={() => toast.dismiss(t)}
              className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {picks.map((p) => {
              const sp = Number(p.sellingPrice) || 0;
              const mrp = Number(p.mrp) || 0;
              const addingThis = addRecommendedMutation.isPending
                && addRecommendedMutation.variables === p.id;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-2"
                >
                  <button
                    onClick={() => {
                      navigate({ name: "product", productId: p.id, slug: p.slug });
                      toast.dismiss(t);
                    }}
                    className="size-12 shrink-0 overflow-hidden rounded-md bg-background"
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
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-xs font-semibold leading-tight text-foreground">
                      {p.name}
                    </p>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span className="text-xs font-bold text-foreground">
                        {formatCurrency(sp)}
                      </span>
                      {mrp > sp && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          {formatCurrency(mrp)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      addRecommendedMutation.mutate(p.id);
                    }}
                    disabled={addingThis}
                    className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    aria-label={`Add ${p.name} to cart`}
                  >
                    {addingThis ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ),
      {
        id: toastId,
        duration: 6000,
        // Position bottom-right on desktop, top on mobile so it doesn't cover
        // the sticky mobile CTA bar at the bottom.
        position: typeof window !== "undefined" && window.innerWidth < 640
          ? "top-center"
          : "bottom-right",
      }
    );
  };

  const go = () => navigate({ name: "product", productId: product.id, slug: product.slug });

  const onAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistically check auth via the me query cache; the API will 401 if not authed
    const me = qc.getQueryData<{ id: string } | null>(qk.me);
    if (!me) {
      toast.info("Please login to add items to your cart");
      navigate({ name: "auth", mode: "login" });
      return;
    }
    addToCartMutation.mutate();
  };

  const onCompareToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inCompare) {
      toggle({ id: product.id, name: product.name, slug: product.slug, sellingPrice: Number(product.sellingPrice), mrp: Number(product.mrp), primaryImage: product.primaryImage, brandName: product.brand?.name, prescriptionRequired: product.prescriptionRequired, stock: Number(product.stock) || 0, composition: product.composition });
      toast.success("Removed from compare");
      return;
    }
    if (isFull) {
      toast.info("Compare tray is full", { description: "Remove a product to add another (max 4)." });
      return;
    }
    toggle({ id: product.id, name: product.name, slug: product.slug, sellingPrice: Number(product.sellingPrice), mrp: Number(product.mrp), primaryImage: product.primaryImage, brandName: product.brand?.name, prescriptionRequired: product.prescriptionRequired, stock: Number(product.stock) || 0, composition: product.composition });
    toast.success("Added to compare", { description: `${count + 1}/4 products selected` });
  };

  return (
    <div className="h-full">
      <Card
        onClick={go}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "group relative h-full cursor-pointer gap-0 overflow-hidden p-0 py-0",
          "border-border/40 rounded-2xl",
          "transition-all duration-300 ease-out",
          "hover:-translate-y-1 hover:border-primary/25",
          "hover:shadow-lg hover:shadow-emerald-100/50 dark:hover:shadow-emerald-950/30",
          "shadow-sm dark:shadow-none",
          "active:scale-95"
        )}
      >
        {/* Image — clean white background, subtle zoom on hover */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-accent/20 to-accent/5">
          <ProductImage
            name={product.name}
            brandName={product.brand?.name}
            primaryImage={product.primaryImage}
            images={product.images}
            size="xl"
            className="!h-full !w-full !text-6xl transition-transform duration-500 ease-out group-hover:scale-105"
          />

          {/* Subtle gradient overlay on hover */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent transition-opacity duration-300",
              hovered ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Discount badge — clean pill */}
          {discountPct > 0 && (
            <div className="absolute left-2.5 top-2.5">
              <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                {discountPct}% OFF
              </span>
            </div>
          )}

          {/* Product feature badges */}
          {discountPct === 0 && product.isBestSeller && (
            <div className="absolute left-2.5 top-2.5">
              <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                ★ Best Seller
              </span>
            </div>
          )}
          {discountPct === 0 && !product.isBestSeller && product.isTrending && (
            <div className="absolute left-2.5 top-2.5">
              <span className="inline-flex items-center rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                🔥 Trending
              </span>
            </div>
          )}

          {/* Wishlist heart (top-right) — pulses subtly on card hover */}
          <div
            className={cn(
              "absolute right-1.5 top-1.5 transition-transform duration-300",
              hovered && "animate-pulse"
            )}
          >
            <WishlistButton productId={product.id} />
          </div>

          {/* Share button (top-right, below wishlist heart) — slides in on
              hover. Small icon-only button that opens the premium ShareButton
              dialog. Uses a glassmorphism chip that matches the WishlistButton
              visual language so the two stacked actions feel cohesive.
              stopPropagation prevents the card click from firing. */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                key="share-toggle"
                initial={{ opacity: 0, y: -8, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.85 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute right-1.5 top-11"
                onClick={(e) => e.stopPropagation()}
              >
                <ShareButton
                  productName={product.name}
                  slug={product.slug}
                  productId={product.id}
                  tagline={product.shortDescription || undefined}
                  variant="icon"
                  className="size-8 rounded-full bg-white/90 p-0 shadow-sm ring-1 ring-black/5 backdrop-blur-md hover:bg-white hover:shadow-md hover:ring-black/10 dark:bg-black/60 dark:ring-white/10 dark:hover:bg-black/80 dark:hover:ring-white/20"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compare toggle (top-left, below discount badge) — appears on
              hover. Filled state shows the compare icon in emerald. */}
          <AnimatePresence>
            {hovered && (
              <motion.button
                key="compare-toggle"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onClick={onCompareToggle}
                aria-label={inCompare ? "Remove from compare" : "Add to compare"}
                className={cn(
                  "absolute left-1.5 flex size-8 items-center justify-center rounded-full shadow-md ring-1 backdrop-blur transition-colors",
                  discountPct > 0 ? "top-9" : "top-1.5",
                  inCompare
                    ? "bg-emerald-600 text-white ring-emerald-700/50"
                    : "bg-white/90 text-foreground ring-black/10 hover:bg-white"
                )}
              >
                <GitCompare className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Prescription badge (bottom-left, so it doesn't clash with the heart) */}
          {product.prescriptionRequired && (
            <Badge
              variant="secondary"
              className="absolute bottom-2 left-2 gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100"
            >
              <FileText className="size-3" />
              Rx
            </Badge>
          )}

          {/* Quick Add floating button — slides up from the bottom-right of the
              image area on hover. Calls the same add-to-cart logic as the bottom CTA.
              Only rendered for in-stock products. */}
          <AnimatePresence>
            {hovered && inStock && (
              <motion.button
                key="quick-add"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                whileTap={{ scale: 0.95 }}
                onClick={onAdd}
                disabled={adding}
                aria-label="Quick add to cart"
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 ring-1 ring-white/30 transition-shadow hover:shadow-emerald-600/50 disabled:opacity-70"
              >
                {adding ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add
              </motion.button>
            )}
          </AnimatePresence>

          {/* Out of stock overlay — prominent red badge + subtle gray veil.
              Disabled card click would be too aggressive (customers still
              want to view details), so we keep the card clickable but
              visually mark it as unavailable. */}
          {(Number(product.stock) || 0) <= 0 && (
            <>
              {/* Subtle gray veil over the image */}
              <div className="absolute inset-0 bg-foreground/40 backdrop-grayscale backdrop-blur-[1px]" />
              {/* Prominent red "Out of Stock" badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg ring-2 ring-white/60">
                  Out of Stock
                </span>
              </div>
            </>
          )}

          {/* Low-stock urgency badge — shows when stock is between 1 and 10.
              Creates a sense of urgency to encourage purchase. */}
          {inStock && (Number(product.stock) || 0) > 0 && (Number(product.stock) || 0) <= 10 && (
            <div className="absolute bottom-2 right-2">
              <span className="flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                <Zap className="size-2.5" />
                Only {Math.max(1, Math.floor(Number(product.stock)))} left
              </span>
            </div>
          )}
        </div>

        {/* Body — `min-w-0` is critical: without it, the flex child's intrinsic
            min-width:auto would let long product names blow past the card width
            and break the grid layout on mobile. Combined with `break-words` on
            the title, this guarantees 2-line truncation regardless of length.
            Premium consistent spacing: `gap-2` between elements + uniform `p-4`
            padding across all breakpoints for visual consistency.
            `flex-1 flex-col` + `mt-auto` on the CTA ensures all cards in a row
            have equal height with the button pinned to the bottom — fixing the
            uneven spacing issue in the Pharmacist Recommended section. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          {product.brand && (
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 xl:text-[9px]">
              {product.brand.name}
            </span>
          )}
          <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground group-hover:text-primary xl:text-xs">
            {product.name}
          </h3>
          {/* Reserve the composition line height even when empty so cards
              with and without composition align. Use a min-height spacer. */}
          <p className="line-clamp-1 break-words text-xs text-muted-foreground xl:text-[11px] min-h-[1rem]">
            {product.composition || "\u00A0"}
          </p>

          {/* Rating — 5-star display with numeric rating + review count.
              Null-safe against partial cache objects. Reserve height so
              cards without ratings don't collapse and cause uneven layout. */}
          <div className="mt-0.5 flex min-h-[1rem] items-center gap-1.5">
            {(Number(product.reviewCount) || 0) > 0 ? (
              <>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const rating = Number(product.avgRating) || 0;
                    return (
                      <Star
                        key={n}
                        className={cn(
                          "size-3",
                          n <= Math.floor(rating)
                            ? "fill-amber-400 text-amber-400"
                            : n <= Math.round(rating)
                            ? "fill-amber-200 text-amber-400"
                            : "fill-muted text-muted-foreground/40"
                        )}
                      />
                    );
                  })}
                </div>
                <span className="text-xs font-medium text-foreground">
                  {(Number(product.avgRating) || 0).toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({product.reviewCount})
                </span>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground/50">New arrival</span>
            )}
          </div>

          {/* Price — selling price larger and bolder, MRP strikethrough smaller. */}
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-foreground xl:text-base">
              {formatCurrency(sellingPrice)}
            </span>
            {mrp > sellingPrice && (
              <span className="text-xs font-medium text-muted-foreground line-through xl:text-[11px]">
                {formatCurrency(mrp)}
              </span>
            )}
            {mrp > sellingPrice && (
              <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 xl:hidden">
                Save {formatCurrency(mrp - sellingPrice)}
              </span>
            )}
          </div>

          {/* Availability + delivery indicator — unified row that adapts to
              stock level. Always rendered with min-height so cards align. */}
          <div className="mt-0.5 flex min-h-[1rem] items-center gap-1.5 text-[10px]">
            {inStock ? (
              <>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium",
                    (Number(product.stock) || 0) <= 10
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      (Number(product.stock) || 0) <= 10
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    )}
                  />
                  {(Number(product.stock) || 0) <= 10
                    ? `Only ${Math.max(1, Math.floor(Number(product.stock)))} left`
                    : "In stock"}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                  <Zap className="size-2.5 text-amber-500" />
                  30–40 min
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                <span className="size-1.5 rounded-full bg-rose-500" />
                Out of stock
              </span>
            )}
          </div>

          {/* Add to cart — OR — Notify Me when out of stock.
              `mt-auto` pins this button to the bottom of the flex column so
              all cards in a row have the button at the same vertical position,
              eliminating the uneven spacing issue. Button is compact (h-8) so
              it fits in 5- and 6-column rows on wide screens. */}
          {inStock ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onAdd}
              disabled={adding}
              className="btn-premium mt-auto h-8 w-full gap-1 border-primary/20 px-2 text-xs text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
            >
              {adding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="size-3.5" />
                  <span className="xl:hidden">Add to cart</span>
                  <span className="hidden xl:inline">Add</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                // Optimistically check auth; BackInStockButton handles the real subscription
                const me = qc.getQueryData<{ id: string } | null>(qk.me);
                if (!me) {
                  toast.info("Please login to subscribe to stock alerts");
                  navigate({ name: "auth", mode: "login" });
                  return;
                }
                // Subscribe via the stock-subscriptions API
                api.post("/api/stock-subscriptions", { productId: product.id })
                  .then(() => {
                    toast.success("Subscribed!", {
                      description: `We'll email you when "${product.name}" is back in stock.`,
                    });
                    qc.invalidateQueries({ queryKey: qk.stockAlerts });
                  })
                  .catch((err: Error) => toast.error(err.message));
              }}
              className="mt-auto h-8 w-full gap-1.5 border-amber-300 bg-amber-50 px-2 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
            >
              <Bell className="size-3.5" />
              Notify Me
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
});

export function ProductCardSkeleton() {
  return (
    <Card className="h-full gap-0 overflow-hidden rounded-xl border-border/50 p-0 py-0 shadow-premium-sm">
      <div className="aspect-square skeleton-premium" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 skeleton-premium rounded" />
        <div className="h-4 w-3/4 skeleton-premium rounded" />
        <div className="h-3 w-1/2 skeleton-premium rounded" />
        <div className="h-5 w-1/4 skeleton-premium rounded" />
        <div className="h-8 w-full skeleton-premium rounded" />
      </div>
    </Card>
  );
}
