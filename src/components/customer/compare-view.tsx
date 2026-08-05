// ============================================================================
// File: src/components/customer/compare-view.tsx
// Purpose: Side-by-side product comparison page. Shows up to 4 products in a
//          table with key attributes (price, discount, brand, category,
//          prescription, stock, composition). Lets customers remove items or
//          add them to cart directly.
// Enhancements (Task 7):
//   - "Best Value" badge on the cheapest product (by sellingPrice).
//   - Amber highlight on cells whose value differs across the comparison.
//   - "Key differences" summary card at the top.
//   - "Print Comparison" button (browser print dialog).
//   - Up to 4 products supported (the use-compare hook already supports 4).
// Role: Accessed via the Compare tray's "Compare Now" button or #v=compare.
// ============================================================================

"use client";

import { useUI } from "@/lib/store";
import { useCompare, CompareProduct } from "./use-compare";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProductImage } from "@/components/shared/product-image";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk } from "./api";
import {
  ArrowLeft,
  X,
  ShoppingCart,
  GitCompare,
  Pill,
  Building2,
  FileText,
  Tag,
  TrendingDown,
  Boxes,
  Printer,
  Crown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";

export function CompareView() {
  const navigate = useUI((s) => s.navigate);
  const { items, remove, clear } = useCompare();
  const qc = useQueryClient();

  const addToCartMutation = useMutation({
    mutationFn: (productId: string) => api.post("/api/cart/add", { productId, qty: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.cart });
      toast.success("Added to cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onAddToCart = (productId: string) => {
    const me = qc.getQueryData<{ id: string } | null>(qk.me);
    if (!me) {
      toast.info("Please login to add items to your cart");
      navigate({ name: "auth", mode: "login" });
      return;
    }
    addToCartMutation.mutate(productId);
  };

  // Find the cheapest product (best value) — used for the crown badge.
  const cheapestId = useMemo(() => {
    if (items.length === 0) return null;
    let cheapest = items[0];
    for (const it of items) {
      if (Number(it.sellingPrice) < Number(cheapest.sellingPrice)) {
        cheapest = it;
      }
    }
    return cheapest.id;
  }, [items]);

  // Compute the set of attributes where values differ across the comparison —
  // these cells get an amber highlight to draw the customer's eye.
  const differingKeys = useMemo(() => {
    if (items.length < 2) return new Set<string>();
    const keys = new Set<string>();
    const allRows = buildRows(items);
    for (const row of allRows) {
      const values = items.map((p) => row.valueKey(p));
      const first = values[0];
      if (values.some((v) => String(v) !== String(first))) {
        keys.add(row.key);
      }
    }
    return keys;
  }, [items]);

  // Key differences summary — bullet list of attributes that differ.
  const keyDifferences = useMemo(() => {
    return Array.from(differingKeys).map((k) => {
      const row = buildRows(items).find((r) => r.key === k);
      return row?.label ?? k;
    });
  }, [differingKeys, items]);

  // Empty state
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border bg-card p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <GitCompare className="size-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">No products to compare</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add products to the comparison tray by clicking the compare icon on product cards.
            </p>
          </div>
          <Button onClick={() => navigate({ name: "shop" })} className="mt-2 gap-1.5">
            <ShoppingCart className="size-4" /> Browse Products
          </Button>
        </div>
      </div>
    );
  }

  const rows = buildRows(items);

  const onPrint = () => {
    // Browser print dialog — opens a print-friendly view of the current page.
    // The page's layout (grid + sticky first column) prints acceptably; the
    // browser handles the rest.
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ name: "shop" })} className="gap-1">
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <GitCompare className="size-5 text-primary" /> Compare Products
            </h1>
            <p className="text-xs text-muted-foreground">{items.length} of 4 products</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrint} className="gap-1">
            <Printer className="size-4" /> <span className="hidden sm:inline">Print</span>
          </Button>
          <Button variant="outline" size="sm" onClick={clear} className="gap-1 text-destructive hover:text-destructive">
            <X className="size-4" /> Clear all
          </Button>
        </div>
      </div>

      {/* Key differences summary — only shown when 2+ products and there are
          actual differences to surface. */}
      {items.length >= 2 && keyDifferences.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-4 print:hidden"
        >
          <Card className="gap-2 border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/10">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Key differences
              </p>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {keyDifferences.map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  className="border-amber-300 bg-white text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  {label}
                </Badge>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300/80">
              Cells where values differ are highlighted with an amber background below.
            </p>
          </Card>
        </motion.div>
      )}

      {/* Comparison grid — first column is attribute labels, then one column per product */}
      <div className="overflow-x-auto">
        <div
          className="grid gap-3 min-w-fit"
          style={{ gridTemplateColumns: `140px repeat(${items.length}, minmax(200px, 1fr))` }}
        >
          {/* Header row: empty cell + product cards */}
          <div className="sticky left-0 bg-card" />
          {items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="relative overflow-hidden p-3">
                {/* Best Value crown badge — shown on the cheapest product
                    only when there are 2+ products to compare against. */}
                {items.length >= 2 && cheapestId === p.id && (
                  <Badge className="absolute left-2 top-2 z-10 gap-1 bg-amber-500 text-white shadow-sm">
                    <Crown className="size-3" /> Best Value
                  </Badge>
                )}
                <button
                  onClick={() => remove(p.id)}
                  className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-destructive hover:text-white print:hidden"
                  aria-label="Remove from compare"
                >
                  <X className="size-3.5" />
                </button>
                <div
                  className="mb-2 cursor-pointer"
                  onClick={() => navigate({ name: "product", productId: p.id, slug: p.slug })}
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-accent/30">
                    <ProductImage
                      name={p.name}
                      brandName={p.brandName}
                      primaryImage={p.primaryImage}
                      size="xl"
                      className="!h-full !w-full !text-5xl"
                    />
                  </div>
                </div>
                <button
                  onClick={() => navigate({ name: "product", productId: p.id, slug: p.slug })}
                  className="line-clamp-2 break-words text-left text-sm font-semibold leading-snug text-foreground hover:text-primary"
                >
                  {p.name}
                </button>
                {p.brandName && (
                  <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {p.brandName}
                  </p>
                )}
              </Card>
            </motion.div>
          ))}

          {/* Attribute rows — each row has a sticky label cell + one value
              cell per product. Differing rows get an amber-tinted background
              so the customer can spot the differences at a glance. */}
          {rows.map((row) => {
            const isDiff = differingKeys.has(row.key);
            return (
              <div key={row.key} className="contents">
                {/* Label cell */}
                <div className={`sticky left-0 flex items-center gap-2 rounded-lg px-3 py-3 text-xs font-semibold uppercase tracking-wide ${isDiff ? "bg-amber-100/80 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "bg-muted/50 text-muted-foreground"}`}>
                  <row.icon className="size-3.5" />
                  {row.label}
                </div>
                {/* Value cells */}
                {items.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center rounded-lg border px-3 py-3 ${isDiff ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/10" : "bg-card"}`}
                  >
                    {row.render(p)}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Add to cart row */}
          <div className="sticky left-0 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground print:hidden">
            <ShoppingCart className="size-3.5" />
            Add to cart
          </div>
          {items.map((p) => (
            <div key={p.id} className="rounded-lg border bg-card px-3 py-3 print:hidden">
              <Button
                size="sm"
                onClick={() => onAddToCart(p.id)}
                disabled={addToCartMutation.isPending}
                className="w-full gap-1.5"
              >
                <ShoppingCart className="size-3.5" />
                {addToCartMutation.isPending && addToCartMutation.variables === p.id ? "Adding..." : "Add to Cart"}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <p className="mt-6 text-center text-xs text-muted-foreground print:hidden">
        Tip: Click a product name or image to view full details. You can compare up to 4 products at a time.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row definitions — each row has a stable key, label, icon, render function,
// AND a valueKey function used to detect differing cells across products.
// Declared OUTSIDE the component for stable refs (lint-friendly).
// ---------------------------------------------------------------------------
interface RowDef {
  key: string;
  label: string;
  icon: typeof Pill;
  render: (p: CompareProduct) => React.ReactNode;
  /** Stable scalar value used to detect differences across products. */
  valueKey: (p: CompareProduct) => string | number | boolean | null | undefined;
}

function buildRows(items: CompareProduct[]): RowDef[] {
  // Compute the cheapest selling price (for the "best value" indicator on
  // the Price row — only shown when there's a meaningful price difference).
  const prices = items.map((p) => Number(p.sellingPrice) || 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const hasPriceDiff = prices.some((p) => p !== minPrice);

  return [
    {
      key: "price",
      label: "Price",
      icon: Tag,
      render: (p) => {
        const sp = Number(p.sellingPrice) || 0;
        const mrp = Number(p.mrp) || 0;
        const isCheapest = hasPriceDiff && sp === minPrice;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-lg font-bold text-emerald-700">
              {formatCurrency(sp)}
              {isCheapest && (
                <Crown className="size-4 text-amber-500" aria-label="Best value" />
              )}
            </span>
            {mrp > sp && (
              <span className="text-xs text-muted-foreground line-through">{formatCurrency(mrp)}</span>
            )}
          </div>
        );
      },
      valueKey: (p) => Number(p.sellingPrice) || 0,
    },
    {
      key: "discount",
      label: "Discount",
      icon: TrendingDown,
      render: (p) => {
        const mrp = Number(p.mrp) || 0;
        const sp = Number(p.sellingPrice) || 0;
        const pct = mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;
        return pct > 0 ? (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{pct}% OFF</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
      valueKey: (p) => {
        const mrp = Number(p.mrp) || 0;
        const sp = Number(p.sellingPrice) || 0;
        return mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;
      },
    },
    {
      key: "brand",
      label: "Brand",
      icon: Building2,
      render: (p) => <span className="text-sm font-medium">{p.brandName || "—"}</span>,
      valueKey: (p) => p.brandName ?? "",
    },
    {
      key: "composition",
      label: "Composition",
      icon: Pill,
      render: (p) =>
        p.composition ? (
          <span className="text-xs text-foreground">{p.composition}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      valueKey: (p) => p.composition ?? "",
    },
    {
      key: "stock",
      label: "Availability",
      icon: Boxes,
      render: (p) => {
        const stock = Number(p.stock) || 0;
        if (stock <= 0) {
          return (
            <Badge variant="outline" className="gap-1 border-rose-300 text-rose-700">
              <AlertCircle className="size-3" /> Out of stock
            </Badge>
          );
        }
        if (stock <= 10) {
          return (
            <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
              <AlertCircle className="size-3" /> Only {stock} left
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700">
            <CheckCircle2 className="size-3" /> In stock
          </Badge>
        );
      },
      valueKey: (p) => {
        const stock = Number(p.stock) || 0;
        if (stock <= 0) return "out";
        if (stock <= 10) return `low-${stock}`;
        return "in";
      },
    },
    {
      key: "prescription",
      label: "Prescription",
      icon: FileText,
      render: (p) =>
        p.prescriptionRequired ? (
          <Badge variant="destructive" className="gap-1">
            <FileText className="size-3" /> Required
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700">
            OTC
          </Badge>
        ),
      valueKey: (p) => Boolean(p.prescriptionRequired),
    },
  ];
}
