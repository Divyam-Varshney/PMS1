// ============================================================================
// File: src/components/customer/product-view.tsx
// Purpose: Premium single-product detail page (Phase 32.7 redesign).
//          Two-column desktop layout (gallery left, info right), sticky mobile
//          CTA bar, product specs table, rich info accordion, FBT, generic
//          alternatives, related products, reviews, trust badges.
//
// Data layer is unchanged from the previous version — we keep:
//   - useQuery(qk.product(slug))            → product detail
//   - useQuery(qk.productRecommendations)   → related / FBT / alternatives
//   - useMutation /api/cart/add             → single + bundle add-to-cart
//   - useAddRecentlyViewed                  → tracks "recently viewed"
//
// Role: Destination after clicking any product card.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, Product, ProductRecommendationsResponse } from "./api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProductImage } from "@/components/shared/product-image";
import { ProductCard } from "@/components/shared/product-card";
import { sanitizeHtml } from "@/lib/sanitize";
import { ProductGallery } from "./product-gallery";
import { BackInStockButton } from "./back-in-stock-button";
import { ReviewsSection } from "@/components/shared/reviews-section";
import { WishlistButton } from "@/components/shared/wishlist-button";
import { ShareButton } from "@/components/shared/share-button";
import { TrustBadges } from "@/components/shared/trust-badges";
import {
  ShoppingCart,
  Minus,
  Plus,
  Star,
  FileText,
  Check,
  X,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Zap,
  Sparkles,
  Pill,
  Package,
  TrendingDown,
  Home,
  Store,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useState, useEffect, Fragment, useRef } from "react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { useAddRecentlyViewed } from "./use-recently-viewed";
import { motion } from "framer-motion";
import { generateProductInfo } from "@/lib/product-info";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Info,
  Pill as PillIcon,
  AlertTriangle,
  Thermometer,
  FileText as FileTextIcon,
  Building2,
  Tag,
  Boxes,
  Ruler,
  Barcode,
  HeartPulse,
} from "lucide-react";

// Map from the section key (defined in src/lib/product-info.ts) to a Lucide
// icon. Declared OUTSIDE the component for stable refs (lint-friendly).
const SECTION_ICON: Record<string, typeof Info> = {
  "uses": Info,
  "how-to-use": PillIcon,
  "side-effects": AlertTriangle,
  "warnings": ShieldCheck,
  "storage": Thermometer,
  "disclaimer": FileTextIcon,
};

interface ProductDetail extends Product {
  reviews: Array<{
    id: string;
    authorName: string;
    rating: number;
    title?: string | null;
    body?: string | null;
    createdAt: string;
  }>;
  // Catalog detail endpoint returns these fields too — they aren't on the
  // base Product type because not every catalog list query selects them.
  lowStockThreshold?: number;
  hsnCode?: string;
  galleryImages?: string | null;
}

export function ProductView() {
  const view = useUI((s) => s.view);
  const navigate = useUI((s) => s.navigate);
  const back = useUI((s) => s.back);
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const addRecentlyViewed = useAddRecentlyViewed();

  const slug = view.name === "product" ? view.slug ?? view.productId : "";

  const { data: product, isLoading } = useQuery({
    queryKey: qk.product(slug),
    queryFn: () => api<ProductDetail>(`/api/catalog/products/${slug}`),
    enabled: !!slug,
  });

  // Reset qty when navigating to a new product.
  useEffect(() => {
    setQty(1);
  }, [product?.id]);

  // Track this product in the "recently viewed" list (localStorage) so the
  // home page can show a "Recently viewed" section.
  useEffect(() => {
    if (!product) return;
    const primaryFromImages = product.images?.find((i) => i.isPrimary)?.imagePath
      || product.images?.[0]?.imagePath
      || product.primaryImage;
    addRecentlyViewed({
      id: product.id,
      name: product.name,
      slug: product.slug,
      sellingPrice: product.sellingPrice,
      mrp: product.mrp,
      primaryImage: primaryFromImages,
      brandName: product.brand?.name ?? null,
    });
  }, [product, addRecentlyViewed]);

  // Intelligent recommendations: related (medical-relevance ranking),
  // frequentlyBought (complementary items, e.g. Dettol → bandages), and
  // alternatives (same generic name, different brand — cheaper substitutes).
  const { data: recommendations } = useQuery({
    queryKey: qk.productRecommendations(product?.id ?? ""),
    queryFn: () =>
      api<ProductRecommendationsResponse>(
        `/api/catalog/recommendations/${encodeURIComponent(product!.id)}`
      ),
    enabled: !!product,
  });

  const relatedProducts = recommendations?.related ?? [];
  const frequentlyBought = recommendations?.frequentlyBought ?? [];
  const alternatives = recommendations?.alternatives ?? [];

  const addToCartMutation = useMutation({
    mutationFn: () => api.post("/api/cart/add", { productId: view.name === "product" ? view.productId : "", qty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cart });
      toast.success("Added to cart", { description: product?.name });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onAddToCart = async () => {
    const me = qc.getQueryData<{ id: string } | null>(qk.me);
    if (!me) {
      toast.info("Please login to add items to your cart");
      navigate({ name: "auth", mode: "login" });
      return;
    }
    addToCartMutation.mutate();
  };

  const onBuyNow = async () => {
    const me = qc.getQueryData<{ id: string } | null>(qk.me);
    if (!me) {
      toast.info("Please login to continue");
      navigate({ name: "auth", mode: "login" });
      return;
    }
    await addToCartMutation.mutateAsync();
    navigate({ name: "checkout" });
  };

  // Frequently Bought Together — bundle the current product with 2 others from
  // the same category and let the customer add the whole combo in one click.
  const addBundleMutation = useMutation({
    mutationFn: async (products: { id: string; name: string }[]) => {
      for (const p of products) {
        await api.post("/api/cart/add", { productId: p.id, qty: 1 });
      }
    },
    onSuccess: (_data, products) => {
      qc.invalidateQueries({ queryKey: qk.cart });
      toast.success(`Added ${products.length} items to cart`, {
        description: "Combo deal added — review your cart to checkout.",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onAddBundle = async (bundle: { id: string; name: string }[]) => {
    const me = qc.getQueryData<{ id: string } | null>(qk.me);
    if (!me) {
      toast.info("Please login to add items to your cart");
      navigate({ name: "auth", mode: "login" });
      return;
    }
    addBundleMutation.mutate(bundle);
  };

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          <Package className="size-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-semibold text-foreground">Product not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The product you&apos;re looking for may have been removed or is no longer available.
        </p>
        <Button onClick={() => navigate({ name: "shop" })} className="mt-6 gap-2">
          <Store className="size-4" /> Browse all products
        </Button>
      </div>
    );
  }

  const discountPct =
    product.mrp > product.sellingPrice
      ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)
      : Math.round(product.baseDiscountPct || 0);

  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= (product.lowStockThreshold ?? 10);
  const saveAmount = Math.max(0, product.mrp - product.sellingPrice);

  // Rich product information sections — generated from product attributes.
  const infoSections = generateProductInfo(product);

  // Specs table rows — Amazon / 1mg-style key-value table.
  const specs: { label: string; value?: string | null; icon: typeof Pill }[] = [
    { label: "Composition", value: product.composition, icon: Pill },
    { label: "Generic Name", value: product.genericName, icon: Tag },
    { label: "Manufacturer", value: product.manufacturer, icon: Building2 },
    { label: "Category", value: product.category?.name, icon: Boxes },
    { label: "Pack Size", value: product.packSize, icon: Package },
    { label: "Unit", value: product.unit, icon: Ruler },
    { label: "Brand", value: product.brand?.name, icon: Tag },
    { label: "HSN Code", value: product.hsnCode, icon: Barcode },
  ].filter((s) => s.value);

  // Short highlights — derived from shortDescription + composition.
  const highlights: string[] = [];
  if (product.shortDescription) highlights.push(product.shortDescription);
  if (product.composition) highlights.push(`Contains ${product.composition}`);
  if (product.genericName) highlights.push(`Generic: ${product.genericName}`);
  if (product.manufacturer) highlights.push(`By ${product.manufacturer}`);
  if (product.prescriptionRequired) highlights.push("Prescription required for purchase");
  else highlights.push("Over-the-counter (no prescription needed)");
  if (inStock) highlights.push("In stock — ready to ship");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
      {/* =====================================================================
          Breadcrumb — Amazon-style: Home / Shop / Brand / Product
      ===================================================================== */}
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
        <button
          onClick={() => navigate({ name: "home" })}
          className="inline-flex items-center gap-1 transition-colors hover:text-primary"
        >
          <Home className="size-3.5" /> Home
        </button>
        <ChevronRight className="size-3 text-muted-foreground/60" />
        <button
          onClick={() => navigate({ name: "shop" })}
          className="transition-colors hover:text-primary"
        >
          Shop
        </button>
        {product.category && (
          <>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <button
              onClick={() => navigate({ name: "shop", categoryId: product.categoryId ?? undefined })}
              className="transition-colors hover:text-primary"
            >
              {product.category.name}
            </button>
          </>
        )}
        {product.brand && (
          <>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <button
              onClick={() => navigate({ name: "shop", brandId: product.brandId ?? undefined })}
              className="transition-colors hover:text-primary"
            >
              {product.brand.name}
            </button>
          </>
        )}
        <ChevronRight className="size-3 text-muted-foreground/60" />
        <span className="line-clamp-1 max-w-[180px] truncate font-medium text-foreground sm:max-w-xs">
          {product.name}
        </span>
      </nav>

      {/* Mobile back button — quick way back without using the breadcrumb. */}
      <button
        onClick={back}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden"
      >
        <ChevronLeft className="size-4" /> Back
      </button>

      {/* =====================================================================
          MAIN TWO-COLUMN LAYOUT — Gallery left, Product info right.
          Mobile: single column. lg+: sticky gallery.
      ===================================================================== */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
        {/* ---------------- GALLERY (left) ---------------- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <ProductGallery
            key={product.id}
            primaryImage={product.primaryImage}
            galleryImages={product.galleryImages}
            productImages={product.images}
            name={product.name}
            brandName={product.brand?.name}
            topLeftBadge={
              discountPct > 0 ? (
                <Badge className="gap-1 bg-emerald-600 text-white shadow-md">
                  <TrendingDown className="size-3" />
                  {discountPct}% OFF
                </Badge>
              ) : null
            }
            topRightBadge={
              product.prescriptionRequired ? (
                <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800">
                  <FileText className="size-3" /> Rx Required
                </Badge>
              ) : null
            }
          />

          {/* Desktop wishlist + share row — sits below the gallery on lg+. */}
          <div className="mt-3 hidden gap-2 lg:flex">
            <WishlistButton
              productId={product.id}
              variant="pill"
              className="flex-1 justify-center"
            />
            <ShareButton
              productName={product.name}
              slug={product.slug}
              productId={product.id}
              tagline={product.shortDescription || undefined}
              variant="full"
              className="flex-1"
            />
          </div>
        </div>

        {/* ---------------- PRODUCT INFO (right) ---------------- */}
        <div className="min-w-0 space-y-5">
          {/* Brand name — clickable */}
          {product.brand && (
            <button
              onClick={() => navigate({ name: "shop", brandId: product.brandId ?? undefined })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary transition-opacity hover:opacity-80"
            >
              {product.brand.logo && product.brand.displayMode !== "name_only" && (
                <img
                  src={product.brand.logo}
                  alt=""
                  className="size-5 rounded-sm object-contain"
                />
              )}
              {product.brand.displayMode !== "logo_only" && (
                <span>Visit {product.brand.name}</span>
              )}
              <ChevronRight className="size-3" />
            </button>
          )}

          {/* Product title + mobile share */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="break-words text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              {product.name}
            </h1>
            <ShareButton
              productName={product.name}
              slug={product.slug}
              productId={product.id}
              tagline={product.shortDescription || undefined}
              variant="icon"
              className="shrink-0 lg:hidden"
            />
          </div>

          {/* Rating row */}
          {product.reviewCount > 0 ? (
            <button
              onClick={() => {
                const el = document.getElementById("product-reviews");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
            >
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${
                      i < Math.round(product.avgRating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
              <span className="font-semibold text-foreground">
                {product.avgRating.toFixed(1)}
              </span>
              <span className="text-muted-foreground underline-offset-2 hover:underline">
                ({product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"})
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="size-3.5 text-muted-foreground/40" />
              <span>No reviews yet · Be the first to review</span>
            </div>
          )}

          {/* ---------------- PRICE BLOCK ---------------- */}
          <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-4 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-transparent">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {formatCurrency(product.sellingPrice)}
              </span>
              {product.mrp > product.sellingPrice && (
                <span className="text-base text-muted-foreground line-through">
                  MRP {formatCurrency(product.mrp)}
                </span>
              )}
              {discountPct > 0 && (
                <Badge className="gap-1 bg-emerald-600 text-white">
                  <TrendingDown className="size-3" />
                  {discountPct}% OFF
                </Badge>
              )}
            </div>
            {saveAmount > 0 && (
              <p className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                You save {formatCurrency(saveAmount)} on this order
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Inclusive of all taxes
            </p>
          </div>

          {/* ---------------- STOCK + Rx + GENERIC BADGES ---------------- */}
          <div className="flex flex-wrap items-center gap-2">
            {inStock ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-300 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <Check className="size-3.5" />
                In Stock
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1.5 border-rose-300 bg-rose-50 px-3 py-1 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <X className="size-3.5" />
                Out of Stock
              </Badge>
            )}
            {lowStock && inStock && (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-300 bg-amber-50 px-3 py-1 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Zap className="size-3.5" />
                Only {product.stock} left
              </Badge>
            )}
            {product.prescriptionRequired && (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-300 bg-amber-50 px-3 py-1 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <FileText className="size-3.5" />
                Prescription Required
              </Badge>
            )}
            {product.isGeneric && (
              <Badge
                variant="outline"
                className="gap-1.5 border-teal-300 bg-teal-50 px-3 py-1 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
              >
                <Pill className="size-3.5" />
                Generic
              </Badge>
            )}
            {product.unit && (
              <Badge variant="outline" className="px-3 py-1 text-muted-foreground">
                Unit: {product.unit}
              </Badge>
            )}
            {product.packSize && (
              <Badge variant="outline" className="px-3 py-1 text-muted-foreground">
                Pack: {product.packSize}
              </Badge>
            )}
          </div>

          {/* ---------------- COMPOSITION / GENERIC NAME ---------------- */}
          {(product.composition || product.genericName) && (
            <div className="rounded-lg border bg-card p-3">
              {product.composition && (
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Composition:</span>{" "}
                  <span className="font-semibold text-foreground">{product.composition}</span>
                </p>
              )}
              {product.genericName && (
                <p className="mt-1 text-sm">
                  <span className="font-medium text-muted-foreground">Generic Name:</span>{" "}
                  <span className="font-semibold text-foreground">{product.genericName}</span>
                </p>
              )}
            </div>
          )}

          {/* ---------------- SHORT HIGHLIGHTS ---------------- */}
          <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/40 py-2.5 pl-3 pr-2 dark:bg-emerald-950/20">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <HeartPulse className="size-3.5" /> Key Highlights
            </p>
            <ul className="space-y-1">
              {highlights.slice(0, 5).map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                  <Check className="mt-0.5 size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------------- DELIVERY INFO ---------------- */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2">
              <Truck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {inStock ? (
                <span className="text-emerald-800 dark:text-emerald-200">
                  <span className="font-semibold">Same-day delivery in Mathura</span>
                  <span className="mx-1 text-emerald-600/60">·</span>
                  <span>Delivers in 2–3 days nationwide</span>
                </span>
              ) : (
                <span className="text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">Back in stock soon</span>
                  <span className="ml-1 text-amber-700/80">— subscribe to be notified</span>
                </span>
              )}
            </div>
            {inStock && product.sellingPrice < 500 && (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Add {formatCurrency(Math.ceil(500 - product.sellingPrice))} more for FREE delivery</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (product.sellingPrice / 500) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {inStock && product.sellingPrice >= 500 && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" /> Eligible for FREE delivery!
              </div>
            )}
          </div>

          {/* ---------------- PRESCRIPTION WARNING (if applicable) ---------------- */}
          {product.prescriptionRequired && (
            <Card className="border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-start gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <FileText className="size-4 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="text-xs text-amber-900 dark:text-amber-100">
                  <p className="font-semibold">Prescription required</p>
                  <p className="mt-0.5 leading-relaxed">
                    This medicine requires a valid doctor&apos;s prescription. You can upload it
                    after adding to cart or at checkout. Our pharmacist will verify before dispatch.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* ---------------- QTY SELECTOR + DESKTOP CTAs ---------------- */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quantity
              </span>
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex size-10 items-center justify-center text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-4" />
                </button>
                <span
                  className="w-12 text-center text-sm font-semibold tabular-nums"
                  aria-live="polite"
                >
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(99, q + 1))}
                  className="flex size-10 items-center justify-center text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={inStock && qty >= product.stock}
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {inStock && (
                <span className="text-xs text-muted-foreground">
                  Subtotal:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(product.sellingPrice * qty)}
                  </span>
                </span>
              )}
            </div>

            {/* CTAs — visible on ALL screen sizes (no sticky bar needed) */}
            <div className="flex gap-3">
              <Button
                onClick={onAddToCart}
                disabled={!inStock || addToCartMutation.isPending}
                variant="outline"
                size="lg"
                className="flex-1 gap-2 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
              >
                {addToCartMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShoppingCart className="size-4" />
                )}
                Add to Cart
              </Button>
              <Button
                onClick={onBuyNow}
                disabled={!inStock}
                size="lg"
                className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
              >
                <Zap className="size-4" /> Buy Now
              </Button>
            </div>

            {/* Wishlist pill — visible on all screens */}
            <div>
              <WishlistButton
                productId={product.id}
                variant="pill"
                className="w-full justify-center"
              />
            </div>

            {/* Out-of-stock restock alert subscription */}
            {!inStock && (
              <BackInStockButton productId={product.id} productName={product.name} />
            )}
          </div>

          {/* ---------------- TRUST BADGES ---------------- */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <TrustBadges variant="compact" />
          </div>

          {/* ---------------- TRUST ICONS GRID ---------------- */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { icon: Truck, title: "Fast Delivery", desc: "Same-day in Mathura" },
              { icon: ShieldCheck, title: "100% Genuine", desc: "Licensed manufacturers" },
              { icon: RefreshCw, title: "Easy Returns", desc: "2-3 hour window" },
              { icon: Pill, title: "Verified Pharmacy", desc: "Licensed pharmacists" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-emerald-100 bg-card p-3 text-center transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-emerald-900/40 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-[11px] font-semibold text-foreground">{item.title}</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>

          {/* ---------------- PRODUCT SPECIFICATIONS TABLE ---------------- */}
          {specs.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b bg-gradient-to-r from-emerald-50/60 to-transparent px-4 py-3 dark:from-emerald-950/20">
                <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Info className="size-4 text-primary" />
                  Product Specifications
                </h2>
              </div>
              <dl className="divide-y divide-border">
                {specs.map((spec) => {
                  const Icon = spec.icon;
                  return (
                    <div
                      key={spec.label}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <dt className="flex items-center gap-2 text-muted-foreground">
                        <Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        {spec.label}
                      </dt>
                      <dd className="text-right font-medium text-foreground">
                        {spec.value || "—"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          )}

          {/* ---------------- MOBILE QUICK SPECS (compact) ---------------- */}
          {/* Shows just the most essential specs in a 2-col grid on mobile,
              before the customer scrolls down to the full Specifications card. */}
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            {product.composition && (
              <div className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Composition
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs font-medium text-foreground">
                  {product.composition}
                </p>
              </div>
            )}
            {product.manufacturer && (
              <div className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Manufacturer
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs font-medium text-foreground">
                  {product.manufacturer}
                </p>
              </div>
            )}
            {product.genericName && (
              <div className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Generic
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs font-medium text-foreground">
                  {product.genericName}
                </p>
              </div>
            )}
            {product.packSize && (
              <div className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pack Size
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs font-medium text-foreground">
                  {product.packSize}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          PRODUCT DESCRIPTION
      ===================================================================== */}
      <div className="mt-8">
        <Card className="overflow-hidden">
          <div className="border-b bg-gradient-to-r from-emerald-50/60 to-transparent px-5 py-3 dark:from-emerald-950/20">
            <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
              <Info className="size-5 text-primary" />
              Product Description
            </h2>
          </div>
          <div className="p-5 text-sm leading-relaxed text-muted-foreground">
            {product.description ? (
              <div
                className="prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
              />
            ) : product.shortDescription ? (
              <p>{product.shortDescription}</p>
            ) : (
              <p>No detailed description available for this product.</p>
            )}
          </div>
        </Card>
      </div>

      {/* =====================================================================
          FREQUENTLY BOUGHT TOGETHER — combo of current product + complementary
          items (Dettol → bandages → cotton). Combined price + single
          "Add All to Cart" CTA.
      ===================================================================== */}
      {frequentlyBought.length > 0 && (() => {
        const bundle = [product, ...frequentlyBought];
        const combinedPrice = bundle.reduce((s, p) => s + Number(p.sellingPrice) || 0, 0);
        const combinedMrp = bundle.reduce((s, p) => s + Number(p.mrp) || 0, 0);
        const bundleSavings = Math.max(0, combinedMrp - combinedPrice);
        const allInStock = bundle.every((p) => (Number(p.stock) || 0) > 0);
        return (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mt-10"
          >
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold sm:text-xl">
              <Sparkles className="size-5 text-amber-500" />
              Frequently Bought Together
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Customers who bought this item also bought these — complete your pharmacy needs in one go.
            </p>
            <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-white p-4 dark:border-emerald-900/40 sm:p-5">
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
                }}
                className="flex flex-col gap-4 lg:flex-row lg:items-stretch"
              >
                {/* Product tiles + "+" separators */}
                <div className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:gap-3">
                  {bundle.map((p, i) => (
                    <Fragment key={p.id}>
                      <motion.button
                        variants={{
                          hidden: { opacity: 0, scale: 0.92, y: 12 },
                          show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
                        }}
                        whileHover={{ y: -3 }}
                        onClick={() =>
                          p.id !== product.id &&
                          navigate({ name: "product", productId: p.id, slug: p.slug })
                        }
                        className={`flex w-28 flex-col gap-1.5 rounded-lg border bg-card p-2 text-left transition-all sm:w-36 ${
                          p.id === product.id
                            ? "border-primary/40 ring-1 ring-primary/20"
                            : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                        }`}
                      >
                        <div className="relative aspect-square overflow-hidden rounded-md bg-accent/30">
                          <ProductImage
                            name={p.name}
                            brandName={p.brand?.name}
                            primaryImage={p.primaryImage}
                            images={p.images}
                            size="md"
                            className="!h-full !w-full !text-2xl"
                          />
                          {p.id === product.id && (
                            <Badge className="absolute left-1 top-1 bg-primary text-[9px] text-white">
                              This item
                            </Badge>
                          )}
                        </div>
                        <span className="line-clamp-2 break-words text-xs font-semibold leading-snug">
                          {p.name}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-bold">
                            {formatCurrency(Number(p.sellingPrice) || 0)}
                          </span>
                          {Number(p.mrp) > Number(p.sellingPrice) && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {formatCurrency(Number(p.mrp) || 0)}
                            </span>
                          )}
                        </div>
                      </motion.button>
                      {i < bundle.length - 1 && (
                        <motion.span
                          variants={{
                            hidden: { opacity: 0, scale: 0.5 },
                            show: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
                          }}
                          className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        >
                          <Plus className="size-4 shrink-0" />
                        </motion.span>
                      )}
                    </Fragment>
                  ))}
                </div>

                {/* Combined price + CTA */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: 16 },
                    show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
                  }}
                  className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-card/80 p-4 lg:w-60 lg:justify-center"
                >
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      <Sparkles className="mr-1 size-3" /> Combo deal
                    </Badge>
                  </div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Price for {bundle.length} items
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(combinedPrice)}
                    </span>
                    {bundleSavings > 0 && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatCurrency(combinedMrp)}
                      </span>
                    )}
                  </div>
                  {bundleSavings > 0 && (
                    <Badge className="w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      You save {formatCurrency(bundleSavings)}
                    </Badge>
                  )}
                  <Button
                    onClick={() => onAddBundle(bundle)}
                    disabled={addBundleMutation.isPending || !allInStock}
                    className="mt-1 gap-2"
                  >
                    {addBundleMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="size-4" />
                    )}
                    Add All to Cart
                  </Button>
                  {!allInStock && (
                    <p className="text-[11px] text-destructive">
                      One or more items in this combo are out of stock.
                    </p>
                  )}
                </motion.div>
              </motion.div>
            </Card>
          </motion.section>
        );
      })()}

      {/* =====================================================================
          GENERIC ALTERNATIVES — same generic name, different brand.
      ===================================================================== */}
      {alternatives.length > 0 && (() => {
        const currentPrice = Number(product.sellingPrice) || 0;
        return (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mt-10"
          >
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold sm:text-xl">
              <TrendingDown className="size-5 text-emerald-600" />
              Save more with generic options
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Same active ingredient ({product.genericName || "—"}), different brand —
              often cheaper. Compare prices below.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {alternatives.map((p) => {
                const altPrice = Number(p.sellingPrice) || 0;
                const savingsVsCurrent = Math.max(0, currentPrice - altPrice);
                return (
                  <div
                    key={p.id}
                    className="relative flex flex-col overflow-hidden rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-white dark:border-emerald-900/40"
                  >
                    {savingsVsCurrent > 0 && (
                      <Badge className="absolute right-2 top-2 z-10 bg-emerald-600 text-[9px] text-white shadow">
                        Save {formatCurrency(savingsVsCurrent)}
                      </Badge>
                    )}
                    <ProductCard product={p} />
                  </div>
                );
              })}
            </div>
          </motion.section>
        );
      })()}

      {/* =====================================================================
          RELATED PRODUCTS — powered by the medical-relevance engine.
          Horizontal scroll on mobile, grid on desktop.
      ===================================================================== */}
      {relatedProducts.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
                <Package className="size-5 text-primary" />
                Related Products
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Medically relevant picks based on category, generic name, and complementary items.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 text-primary sm:flex"
              onClick={() => navigate({ name: "shop", categoryId: product.categoryId ?? undefined })}
            >
              View all <ChevronRight className="size-4" />
            </Button>
          </div>
          {/* Horizontal scroll on mobile */}
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {relatedProducts.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="w-40 shrink-0 sm:w-52 lg:w-auto"
              >
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =====================================================================
          CUSTOMER REVIEWS — full section with id for breadcrumb scroll.
      ===================================================================== */}
      <section id="product-reviews" className="mt-10 scroll-mt-4">
        <ReviewsSection productId={product.id} />
      </section>

    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductDetailSkeleton — premium loading state matching the new layout.
// ---------------------------------------------------------------------------
function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Breadcrumb skeleton */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-12 animate-pulse rounded bg-accent" />
        <div className="h-3 w-3 animate-pulse rounded bg-accent" />
        <div className="h-3 w-16 animate-pulse rounded bg-accent" />
        <div className="h-3 w-3 animate-pulse rounded bg-accent" />
        <div className="h-3 w-24 animate-pulse rounded bg-accent" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
        {/* Gallery skeleton */}
        <div className="space-y-3">
          <div className="aspect-square animate-pulse rounded-xl bg-accent" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="size-16 animate-pulse rounded-md bg-accent" />
            ))}
          </div>
        </div>
        {/* Info skeleton */}
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-accent" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-accent" />
          <div className="h-4 w-32 animate-pulse rounded bg-accent" />
          <div className="h-20 w-full animate-pulse rounded-xl bg-accent" />
          <div className="h-8 w-1/2 animate-pulse rounded bg-accent" />
          <div className="h-12 w-full animate-pulse rounded bg-accent" />
          <div className="h-10 w-full animate-pulse rounded bg-accent" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-20 animate-pulse rounded bg-accent" />
            <div className="h-20 animate-pulse rounded bg-accent" />
          </div>
        </div>
      </div>
    </div>
  );
}
