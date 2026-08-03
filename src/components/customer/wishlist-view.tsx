// ============================================================================
// File: src/components/customer/wishlist-view.tsx
// Purpose: "My Wishlist" page — grid of products the customer has saved.
//          Each card can be moved to cart or removed. Empty state with CTA.
//          Premium styling: rounded-xl cards, border-border/50, shadow-premium-sm.
//          Skeleton grid uses the skeleton-premium shimmer class.
// Role: Reached from the account menu + a shortcut on the account page.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  ShoppingCart,
  Trash2,
  Loader2,
  ArrowRight,
  Package,
} from "lucide-react";
import { api, qk, WishlistProduct } from "./api";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useUI } from "@/lib/store";
import { toast } from "sonner";
import { useState } from "react";
import { motion } from "framer-motion";

export function WishlistView() {
  const navigate = useUI((s) => s.navigate);
  const setCartOpen = useUI((s) => s.setCartOpen);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: wishlist, isLoading } = useQuery({
    queryKey: qk.wishlist,
    queryFn: () => api<{ items: WishlistProduct[] }>("/api/wishlist"),
  });

  const items = wishlist?.items ?? [];

  const addAllToCart = useMutation({
    mutationFn: async () => {
      // Sequential adds so the cart line items preserve the wishlist order.
      // Each add returns the full cart, but we only need the final state.
      let added = 0;
      let failed = 0;
      for (const p of items) {
        try {
          await api.post("/api/cart/add", { productId: p.id, qty: 1 });
          added++;
        } catch {
          failed++;
        }
      }
      return { added, failed };
    },
    onMutate: () => setBusy("all"),
    onSuccess: ({ added, failed }) => {
      qc.invalidateQueries({ queryKey: qk.cart });
      if (added > 0 && failed === 0) {
        toast.success(`Added ${added} item${added > 1 ? "s" : ""} to cart`, {
          action: { label: "View cart", onClick: () => setCartOpen(true) },
        });
      } else if (added > 0 && failed > 0) {
        toast.success(
          `Added ${added} item${added > 1 ? "s" : ""}. ${failed} unavailable.`,
          {
            description: "Some items could not be added (out of stock).",
            action: { label: "View cart", onClick: () => setCartOpen(true) },
          }
        );
      } else {
        toast.error("Could not add items — they may be out of stock.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  const removeOne = async (productId: string, name: string) => {
    setBusy(productId);
    try {
      await api.del(`/api/wishlist/${productId}`);
      qc.invalidateQueries({ queryKey: qk.wishlist });
      toast.success(`Removed "${name}" from wishlist`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove item");
    } finally {
      setBusy(null);
    }
  };

  // -- Loading state — premium skeleton grid (8 cards matching the grid layout).
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <WishlistHeaderSkeleton />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // -- Empty state — friendly CTA.
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart icon on any product to save it here for later. Saved items stay across devices once you log in."
          action={
            <Button
              onClick={() => navigate({ name: "shop" })}
              className="gap-2"
            >
              Browse medicines <ArrowRight className="size-4" />
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} saved item{items.length > 1 ? "s" : ""} — tap{" "}
          <span className="font-medium text-foreground">Add to cart</span> on a
          card, or move everything at once.
        </p>
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────── */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-border/50 p-3 shadow-premium-sm sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <Heart className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {items.length} saved item{items.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Move everything to your cart in one tap.
            </p>
          </div>
        </div>
        <Button
          onClick={() => addAllToCart.mutate()}
          disabled={addAllToCart.isPending}
          className="gap-2 shadow-premium-sm"
        >
          {busy === "all" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShoppingCart className="size-4" />
          )}
          Add all to cart
        </Button>
      </Card>

      {/* ── Product grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {items.map((p, idx) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
            className="relative"
          >
            <ProductCard product={p} />
            {/* Remove button — top-right floating, with confirmation tooltip */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => removeOne(p.id, p.name)}
              disabled={busy === p.id}
              className="absolute -right-2 -top-2 size-7 rounded-full border-rose-200 bg-rose-50 text-rose-500 shadow-premium-sm transition-all hover:bg-rose-100 hover:text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40"
              aria-label={`Remove ${p.name} from wishlist`}
              title={`Remove ${p.name}`}
            >
              {busy === p.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* ── Footer CTA ──────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/60 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="size-4 text-primary" />
          <span>Looking for more options?</span>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate({ name: "shop" })}
          className="gap-2"
        >
          Continue shopping <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* Helpful badge hint at the bottom */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-1 px-1 py-0 text-[10px]">
          Tip
        </Badge>
        Wishlist items are reserved for you — they don&apos;t hold stock.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WishlistHeaderSkeleton — shown above the skeleton grid while the wishlist
// query resolves. Matches the real header's height so the grid doesn't shift.
// ---------------------------------------------------------------------------
function WishlistHeaderSkeleton() {
  return (
    <div className="mb-5 space-y-2">
      <div className="h-7 w-40 skeleton-premium rounded" />
      <div className="h-4 w-80 skeleton-premium rounded" />
    </div>
  );
}
