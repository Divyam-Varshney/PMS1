// ============================================================================
// File: src/components/customer/bundle-view.tsx
// Purpose: Dedicated "all health bundles" page. Renders a responsive grid of
//          all medical bundles (each as an expandable card). Expanding a
//          bundle reveals every product in the kit with its own ProductCard
//          so the customer can buy the whole bundle or individual items.
//
// Role: Destination of the "View All Health Bundles" button on the home page
//       Medical Bundles carousel. Reachable via navigate({ name: "bundles" }).
//
// Palette: emerald / teal / amber — NO indigo or blue.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, BundlesResponse, MedicalBundleResponse, Product } from "./api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProductCard } from "@/components/shared/product-card";
import { ProductImage } from "@/components/shared/product-image";
import { useUI } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronLeft,
  ChevronDown,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createElement, useState } from "react";

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

/** Renders a bundle's Lucide icon by name via createElement (satisfies the
 *  react-hooks/static-components lint rule — runtime lookup, not a static
 *  component def). */
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

/** Expandable bundle card — header always visible; products toggle. */
function BundleAccordion({ bundle, defaultOpen = false }: { bundle: MedicalBundleResponse; defaultOpen?: boolean }) {
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);

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

  const allInStock = bundle.inStockCount === bundle.products.length;

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40 sm:p-5"
        aria-expanded={open}
        aria-controls={`bundle-content-${bundle.id}`}
      >
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${bundle.accentColor} text-white shadow-sm`}
        >
          <BundleIcon name={bundle.icon} className="size-6" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-tight text-foreground sm:text-lg">
            {bundle.name}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
            {bundle.description}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {bundle.products.length} items
            </Badge>
            {bundle.totalSavings > 0 && (
              <Badge className="bg-amber-100 text-[10px] text-amber-800">
                <Sparkles className="mr-1 size-2.5" /> Save {formatCurrency(bundle.totalSavings)}
              </Badge>
            )}
            {bundle.inStockCount === bundle.products.length ? (
              <Badge variant="outline" className="border-emerald-300 text-[10px] text-emerald-700">
                All in stock
              </Badge>
            ) : bundle.inStockCount > 0 ? (
              <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-700">
                {bundle.inStockCount}/{bundle.products.length} in stock
              </Badge>
            ) : (
              <Badge variant="outline" className="border-destructive text-[10px] text-destructive">
                Out of stock
              </Badge>
            )}
          </div>
        </div>
        <div className="hidden flex-col items-end gap-0.5 sm:flex">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Bundle price
          </p>
          <span className="text-lg font-bold text-primary">
            {formatCurrency(bundle.combinedPrice)}
          </span>
          {bundle.combinedMrp > bundle.combinedPrice && (
            <span className="text-[11px] text-muted-foreground line-through">
              {formatCurrency(bundle.combinedMrp)}
            </span>
          )}
        </div>
        <ChevronDown
          className={`size-5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expandable product grid */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`bundle-content-${bundle.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={`border-t bg-gradient-to-b ${bundle.accentBg} p-4 sm:p-5`}>
              {/* Mobile price row */}
              <div className="mb-3 flex items-center justify-between sm:hidden">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Bundle price
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-primary">
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
                  className="gap-1.5"
                >
                  {addBundleMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ShoppingCart className="size-3.5" />
                  )}
                  Add all
                </Button>
              </div>

              {/* Quick thumbnail strip — click any to jump to product */}
              <div className="mb-4 flex flex-wrap gap-2">
                {bundle.products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate({ name: "product", productId: p.id, slug: p.slug })}
                    className="group/thumb flex items-center gap-2 rounded-lg border bg-card p-1.5 pr-3 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    title={p.name}
                  >
                    <div className="size-9 overflow-hidden rounded-md">
                      <ProductImage
                        name={p.name}
                        brandName={p.brand?.name}
                        primaryImage={p.primaryImage}
                        images={p.images}
                        size="sm"
                        className="!h-9 !w-9 !text-xs"
                      />
                    </div>
                    <div className="min-w-0 max-w-[120px] text-left">
                      <p className="truncate text-[11px] font-semibold leading-tight">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(p.sellingPrice)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop add-to-cart CTA */}
              <div className="mb-4 hidden items-center justify-between rounded-lg border border-emerald-100 bg-card/80 p-3 sm:flex">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Price for {bundle.products.length} items
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(bundle.combinedPrice)}
                    </span>
                    {bundle.combinedMrp > bundle.combinedPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatCurrency(bundle.combinedMrp)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={onAddBundle}
                  disabled={addBundleMutation.isPending || bundle.inStockCount === 0}
                  className="gap-2"
                >
                  {addBundleMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="size-4" />
                  )}
                  Add all {bundle.products.length} items
                </Button>
              </div>

              {/* Full ProductCard grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {bundle.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {!allInStock && bundle.inStockCount > 0 && (
                <p className="mt-3 text-[11px] text-amber-600">
                  Note: Some items in this bundle are out of stock. They will be
                  skipped when you click &quot;Add all&quot;.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function BundleView() {
  const navigate = useUI((s) => s.navigate);
  const { data, isLoading } = useQuery({
    queryKey: qk.bundles,
    queryFn: () => api<BundlesResponse>("/api/catalog/bundles"),
  });

  const bundles = data?.bundles ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Back */}
      <button
        onClick={() => navigate({ name: "home" })}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to home
      </button>

      {/* Hero header */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-md sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Package className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Health Bundles</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/90 sm:text-base">
              Medically curated kits for everyday health needs — from first aid
              to diabetes care. Save more when you buy together.
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-accent/30" />
          ))}
        </div>
      )}

      {/* Empty state — every bundle resolved to 0 products */}
      {!isLoading && bundles.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="mx-auto mb-3 size-12 text-muted-foreground" />
          <h2 className="text-lg font-bold">No bundles available</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We couldn&apos;t assemble any medical bundles from the current
            catalog. Please check back later.
          </p>
          <Button onClick={() => navigate({ name: "shop" })} className="mt-4">
            Browse all products
          </Button>
        </Card>
      )}

      {/* Accordion list */}
      {!isLoading && bundles.length > 0 && (
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
          className="space-y-3"
        >
          {bundles.map((b, i) => (
            <motion.div
              key={b.id}
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
              }}
            >
              <BundleAccordion bundle={b} defaultOpen={i === 0} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
