// ============================================================================
// File: src/components/customer/cart-view.tsx
// Purpose: Full cart page. Line items with qty steppers/remove, voucher input,
//          discount breakdown (product / voucher), delivery estimate,
//          proceed to checkout. Empty state with shop CTA.
// Role: The dedicated cart view (vs the quick CartSheet drawer).
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, Cart, Product, ProductListResponse, CartItemPricing } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProductImage } from "@/components/shared/product-image";
import { EmptyState } from "@/components/shared/empty-state";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag, X, Loader2, Truck, ShieldCheck, Gift, MapPin, Sparkles, Check, FileText } from "lucide-react";
import { useUI } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { computeEarnablePoints } from "@/lib/loyalty";
import { toast } from "sonner";
import { useState } from "react";

export function CartView() {
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [voucherInput, setVoucherInput] = useState("");

  const { data: cart, isLoading } = useQuery({
    queryKey: qk.cart,
    queryFn: () => api<Cart>("/api/cart"),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { productId: string; qty: number }) =>
      api.post<Cart>("/api/cart/update", vars),
    onSuccess: (data) => qc.setQueryData(qk.cart, data),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.post<Cart>("/api/cart/remove", { productId }),
    onSuccess: (data) => qc.setQueryData(qk.cart, data),
    onError: (e: Error) => toast.error(e.message),
  });

  const applyVoucherMutation = useMutation({
    mutationFn: (code: string) => api.post<Cart>("/api/cart/voucher", { code }),
    onSuccess: (data) => {
      qc.setQueryData(qk.cart, data);
      toast.success("Voucher applied successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeVoucherMutation = useMutation({
    mutationFn: () => api.del<Cart>("/api/cart/voucher"),
    onSuccess: (data) => {
      qc.setQueryData(qk.cart, data);
      toast.success("Voucher removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Add-to-cart mutation used by the smart-recommendations "Add" button. Reuses
  // the existing /api/cart/add endpoint and refreshes the cart cache on success.
  const addRecommendedMutation = useMutation({
    mutationFn: (productId: string) =>
      api.post<Cart>("/api/cart/add", { productId, qty: 1 }),
    onSuccess: (data) => {
      qc.setQueryData(qk.cart, data);
      toast.success("Added to cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <CartSkeleton />;
  }

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse our catalog of 300+ genuine medicines, wellness & personal-care products. Add items to your cart and check out in minutes — with same-day delivery across Mathura."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => navigate({ name: "shop" })} className="gap-2">
                Browse medicines <ArrowRight className="size-4" />
              </Button>
              <Button
                onClick={() => navigate({ name: "prescription" })}
                variant="outline"
                className="gap-2 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <FileText className="size-4" /> Upload prescription
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const pricing = cart!.pricing;
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:pb-6">
      <h1 className="mb-4 text-2xl font-bold">Your Cart</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => {
            const line = pricing.lines.find((l) => l.productId === item.productId);
            // effectivePrice = per-unit price the customer actually pays.
            // Use the engine's finalLineTotal (line total after product +
            // voucher discounts) when available. `!= null` (not truthy) so a
            // voucher that fully covers a line (finalLineTotal = 0) still
            // displays as ₹0.00 instead of falling back to sellingPrice.
            const effectivePrice = line?.finalLineTotal != null
              ? line.finalLineTotal / item.quantity
              : item.product.sellingPrice;
            // Actual applied discount % — derived from the engine's
            // appliedDiscountPct (or MRP vs effectivePrice). This is what
            // the customer is actually saving, NOT the theoretical max
            // (MRP vs sellingPrice), which can differ when maxDiscountPct
            // caps the discount below the configured sellingPrice.
            const actualDiscountPct =
              item.product.mrp > effectivePrice
                ? Math.round(((item.product.mrp - effectivePrice) / item.product.mrp) * 100)
                : 0;
            return (
              <Card key={item.id} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                <button
                  onClick={() => navigate({ name: "product", productId: item.productId, slug: item.product.slug })}
                  className="shrink-0"
                >
                  <ProductImage
                    name={item.product.name}
                    primaryImage={item.product.primaryImage}
                    size="md"
                    className="!h-20 !w-20 rounded-lg !text-3xl sm:!h-24 sm:!w-24"
                  />
                </button>
                <div className="flex flex-1 flex-col">
                  <button
                    onClick={() => navigate({ name: "product", productId: item.productId, slug: item.product.slug })}
                    className="line-clamp-2 break-words text-left text-sm font-semibold hover:text-primary sm:text-base"
                  >
                    {item.product.name}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {item.product.brand?.name && <span>{item.product.brand.name}</span>}
                    {item.product.unit && <span>• {item.product.unit}</span>}
                    {item.product.packSize && <span>• {item.product.packSize}</span>}
                    {item.product.prescriptionRequired && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">Rx</Badge>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                    <span className="text-sm font-bold sm:text-base">{formatCurrency(effectivePrice)}</span>
                    {actualDiscountPct > 0 && (
                      <>
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(item.product.mrp)}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] hover:bg-emerald-100">
                          {actualDiscountPct}% OFF
                        </Badge>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    {/* Quantity stepper — bigger touch targets (size-9 ≈ 36px)
                        per the spec's "clear +/- buttons" requirement.
                        Disabled state during pending updates prevents the
                        customer from spamming the API. */}
                    <div className="flex items-center rounded-lg border bg-card shadow-sm">
                      <button
                        onClick={() =>
                          updateMutation.mutate({ productId: item.productId, qty: item.quantity - 1 })
                        }
                        disabled={updateMutation.isPending || item.quantity <= 1}
                        className="flex size-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-12 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateMutation.mutate({ productId: item.productId, qty: item.quantity + 1 })
                        }
                        disabled={updateMutation.isPending}
                        className="flex size-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    {/* Remove — prominent icon button with hover-destructive tint
                        for clearer "delete this item" affordance on mobile. */}
                    <button
                      onClick={() => removeMutation.mutate(item.productId)}
                      disabled={removeMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive disabled:opacity-40"
                      aria-label={`Remove ${item.product.name} from cart`}
                    >
                      <Trash2 className="size-4" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>

                {/* Line total — desktop only. On mobile the line total is
                    implicit (unit price × qty shown via the stepper value). */}
                <div className="hidden flex-col items-end justify-between sm:flex">
                  <span className="text-sm font-bold">{formatCurrency(effectivePrice * item.quantity)}</span>
                </div>
              </Card>
            );
          })}

          <Button variant="ghost" onClick={() => navigate({ name: "shop" })} className="gap-1">
            <ArrowRight className="size-4 rotate-180" /> Continue shopping
          </Button>

          {/* Smart recommendations — shown only when the delivery zone has a
              `freeAbove` threshold AND the cart subtotal is below it. Pulls
              the cheapest products from /api/catalog/products (price-asc) and
              renders 3-4 small cards the customer can one-click add. */}
          <SmartRecommendations
            cart={cart!}
            onAdd={(productId) => addRecommendedMutation.mutate(productId)}
            addingProductId={
              addRecommendedMutation.isPending
                ? (addRecommendedMutation.variables ?? null)
                : null
            }
            navigate={navigate}
          />
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 gap-3 p-4">
            <h2 className="text-base font-semibold">Order Summary</h2>

            {/* Free-delivery / savings callout — shows prominently whether the
                customer has unlocked free delivery or what they're still paying.
                When the matched zone exposes a `freeAbove` threshold, render an
                inline progress bar so the customer sees how close they are. */}
            {cart?.delivery && (
              <div
                className={`rounded-lg border p-3 ${
                  cart.delivery.free
                    ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                {cart.delivery.free ? (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label="party">
                      🎉
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-800">
                        You&apos;ve unlocked FREE Delivery!
                      </p>
                      <p className="text-xs text-emerald-700">
                        Enjoy free doorstep delivery on this order.
                      </p>
                    </div>
                    <Badge className="bg-emerald-600 text-white">SAVED</Badge>
                  </div>
                ) : cart.delivery.freeAbove ? (
                  <FreeDeliveryProgress
                    subtotal={pricing.totalAfterVoucher}
                    freeAbove={cart.delivery.freeAbove}
                    charge={cart.delivery.charge ?? 0}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <Truck className="size-4 text-amber-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900">
                        Delivery charge: {formatCurrency(cart.delivery.charge ?? 0)}
                      </p>
                      <p className="text-xs text-amber-700">
                        Add more items to qualify for FREE delivery.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Voucher */}
            {cart?.voucherCode && pricing.voucherValid ? (
              <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-emerald-700">
                  <Tag className="size-4" /> {cart.voucherCode}
                </span>
                <button
                  onClick={() => removeVoucherMutation.mutate()}
                  className="text-emerald-700 hover:text-emerald-900"
                  aria-label="Remove voucher"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Voucher code"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                  className="uppercase"
                />
                <Button
                  variant="outline"
                  disabled={!voucherInput || applyVoucherMutation.isPending}
                  onClick={() => voucherInput && applyVoucherMutation.mutate(voucherInput)}
                >
                  {applyVoucherMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Apply Voucher"}
                </Button>
              </div>
            )}
            {pricing.voucherError && (
              <p className="text-xs text-destructive">{pricing.voucherError}</p>
            )}

            <Separator />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <Row label={`Items (${totalQty})`} value={formatCurrency(pricing.itemsTotal)} />
              {pricing.productDiscount > 0 && (
                <Row
                  label="Product discount"
                  value={`- ${formatCurrency(pricing.productDiscount)}`}
                  color="text-emerald-700"
                />
              )}
              {pricing.voucherDiscount > 0 && (
                <Row
                  label={`Voucher${pricing.voucherCode ? ` (${pricing.voucherCode})` : ""}`}
                  value={`- ${formatCurrency(pricing.voucherDiscount)}`}
                  color="text-emerald-700"
                />
              )}
              <Row
                label="Delivery"
                value={
                  cart?.delivery?.free
                    ? "FREE"
                    : formatCurrency(cart?.delivery?.charge ?? 0)
                }
                color={cart?.delivery?.free ? "text-emerald-700 font-medium" : undefined}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(cart?.grandTotal ?? 0)}</span>
            </div>

            {/* "You'll earn X points" hint — based on the cart's grandTotal.
                Only shown when the customer would actually earn points (> 0). */}
            {(() => {
              const earnable = computeEarnablePoints(cart?.grandTotal ?? 0);
              if (earnable <= 0) return null;
              return (
                <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-emerald-50 px-3 py-1.5 text-xs text-amber-800">
                  <Gift className="size-3.5 shrink-0 text-amber-600" />
                  <span>
                    You&apos;ll earn{" "}
                    <strong className="font-semibold text-emerald-700">
                      {earnable.toLocaleString("en-IN")} points
                    </strong>{" "}
                    on this order <span className="text-muted-foreground">(when delivered)</span>
                  </span>
                </div>
              );
            })()}

            {/* Next-discount-unlock message — derived from the pricing engine's
                upgradeThreshold + per-line base/max discount %. Encourages the
                customer to spend a bit more to unlock extra discounts on
                eligible (max > base) products. */}
            <NextDiscountUnlock
              subtotal={pricing.totalAfterVoucher}
              upgradeThreshold={pricing.upgradeThreshold}
              upgraded={pricing.upgraded}
              lines={pricing.lines}
            />

            {cart?.delivery?.message && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Truck className="size-3.5" /> {cart.delivery.message}
              </p>
            )}
            {cart?.delivery?.zoneName && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3.5" /> Delivery zone: {cart.delivery.zoneName}
              </p>
            )}

            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => navigate({ name: "checkout" })}
            >
              Proceed to checkout <ArrowRight className="size-4" />
            </Button>

            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-emerald-600" /> Secure checkout
              </span>
              <span className="flex items-center gap-1">
                <Truck className="size-3.5 text-emerald-600" /> Fast delivery
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* =====================================================================
          MOBILE STICKY CHECKOUT BAR — Amazon / 1mg-style bottom bar with
          grand total + Proceed to checkout button. Always visible on mobile
          so the customer can check out without scrolling back to the top.
          Hidden on lg+ where the inline summary card's CTA is already
          sticky (top-20). Safe-area padding for iOS notch.
      ===================================================================== */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Checkout action"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {totalQty} {totalQty === 1 ? "item" : "items"} · Total
            </p>
            <p className="truncate text-lg font-bold leading-tight text-primary">
              {formatCurrency(cart?.grandTotal ?? 0)}
            </p>
          </div>
          <Button
            size="lg"
            className="shrink-0 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
            onClick={() => navigate({ name: "checkout" })}
          >
            Checkout <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={color ?? "font-medium"}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Free-delivery progress bar — shown in the cart's Order Summary card when the
// matched delivery zone exposes a `freeAbove` threshold. Renders the standard
// "Add ₹X more" message + a slim amber→emerald progress bar.
// ---------------------------------------------------------------------------
function FreeDeliveryProgress({
  subtotal,
  freeAbove,
  charge,
}: {
  subtotal: number;
  freeAbove: number;
  charge: number;
}) {
  const pct = Math.min(100, Math.max(0, (subtotal / freeAbove) * 100));
  const remaining = Math.max(0, freeAbove - subtotal);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Truck className="size-4 text-amber-700" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Add {formatCurrency(remaining)} more for FREE delivery
          </p>
          <p className="text-xs text-amber-700">
            Delivery charge now: {formatCurrency(charge)} •{" "}
            <span className="font-medium">Free above {formatCurrency(freeAbove)}</span>
          </p>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-emerald-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-[11px] text-muted-foreground">{Math.round(pct)}% there</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next-discount-unlock message — derived from the pricing engine's
// `upgradeThreshold` (admin setting `discount.cartThresholdForUpgrade`) and the
// per-line `baseDiscountPct` / `maxDiscountPct` (eligible items only). Encourages
// the customer to spend a bit more to unlock extra discounts on eligible products.
// ---------------------------------------------------------------------------
function NextDiscountUnlock({
  subtotal,
  upgradeThreshold,
  upgraded,
  lines,
}: {
  subtotal: number;
  upgradeThreshold: number;
  upgraded: boolean;
  lines: CartItemPricing[];
}) {
  // No threshold configured → feature is off; render nothing.
  if (!upgradeThreshold || upgradeThreshold <= 0) return null;

  // Find the maximum *additional* discount any line could gain (max - base).
  const maxExtra = lines.reduce(
    (max, l) => Math.max(max, (l.maxDiscountPct ?? 0) - (l.baseDiscountPct ?? 0)),
    0
  );

  // Already upgraded → cart has reached the threshold AND at least one line
  // was bumped to its max discount. Show the success message.
  if (upgraded) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <Check className="size-3.5 shrink-0 text-emerald-600" />
        <span className="font-medium">🎉 Your cart qualifies for maximum discount!</span>
      </div>
    );
  }

  // No line has reserve margin (max > base) → no upgrade is possible, ever,
  // for this cart's contents. Don't claim "maximum discount" because the
  // threshold hasn't been reached; just render nothing (the savings are
  // already reflected in the line-item discounts above).
  if (maxExtra <= 0) return null;

  const remaining = Math.max(0, upgradeThreshold - subtotal);
  if (remaining <= 0) {
    // Subtotal has reached the threshold but `upgraded` is still false — this
    // happens when none of the lines have reserve margin. Show the same "max"
    // message; no extra discount is possible.
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <Check className="size-3.5 shrink-0 text-emerald-600" />
        <span className="font-medium">🎉 Your cart qualifies for maximum discount!</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
      <span>
        Spend{" "}
        <strong className="font-semibold text-sky-800">{formatCurrency(remaining)}</strong>{" "}
        more to unlock up to{" "}
        <strong className="font-semibold text-sky-800">
          {Math.round(maxExtra)}% extra discount
        </strong>{" "}
        on eligible products.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart recommendations — pulls the cheapest products from /api/catalog/products
// (sort=price-asc) and renders 3-4 small cards the customer can one-click add
// to bridge the gap to the free-delivery threshold. Only shown when the zone
// has a `freeAbove` AND the cart subtotal is below it.
// ---------------------------------------------------------------------------
function SmartRecommendations({
  cart,
  onAdd,
  addingProductId,
  navigate,
}: {
  cart: Cart;
  onAdd: (productId: string) => void;
  addingProductId: string | null;
  navigate: ReturnType<typeof useUI.getState>["navigate"];
}) {
  const freeAbove = cart.delivery?.freeAbove;
  const subtotal = cart.pricing.totalAfterVoucher;
  const cartProductIds = new Set(cart.items.map((i) => i.productId));

  // Only show when there's a threshold to chase AND we're below it.
  const shouldShow = !!(
    freeAbove &&
    freeAbove > 0 &&
    !cart.delivery?.free &&
    subtotal < freeAbove
  );

  // Query the cheapest products. We ask for a generous page so we can find
  // ~4 products not already in the cart whose total fills the gap.
  const { data, isLoading } = useQuery({
    queryKey: qk.recommendations(subtotal, freeAbove ?? null),
    queryFn: () =>
      api.get<ProductListResponse>(
        `/api/catalog/products?sort=price-asc&limit=24`
      ),
    enabled: shouldShow,
    staleTime: 60_000,
  });

  if (!shouldShow || !freeAbove) return null;

  const remaining = Math.max(0, freeAbove - subtotal);

  // Pick 3-4 products:
  //   - not already in cart
  //   - in stock (stock > 0)
  //   - with sellingPrice <= remaining * 1.5 (so adding ~one fills most of the gap)
  //   - capped at 4
  const candidates = (data?.items ?? [])
    .filter((p: Product) => !cartProductIds.has(p.id) && p.stock > 0)
    .filter((p: Product) => p.sellingPrice <= remaining * 1.5 || p.sellingPrice <= remaining + 50)
    .slice(0, 4);

  if (!isLoading && candidates.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-amber-100">
          <Truck className="size-4 text-amber-700" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900">
            Add {formatCurrency(remaining)} more for FREE delivery
          </h3>
          <p className="text-xs text-amber-700">
            Quick picks to unlock free delivery on this order.
          </p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          <Loader2 className="mr-2 size-3.5 animate-spin" /> Loading recommendations…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {candidates.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAdd(p.id)}
              disabled={addingProductId === p.id}
              className="group flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-white p-2 text-left transition-colors hover:border-amber-400 hover:bg-amber-50 disabled:opacity-60"
            >
              <ProductImage
                name={p.name}
                primaryImage={p.primaryImage}
                size="sm"
                className="!h-14 !w-full rounded-md !text-base"
              />
              <p className="line-clamp-2 break-words text-xs font-medium leading-tight">{p.name}</p>
              <div className="mt-auto flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-foreground">
                  {formatCurrency(p.sellingPrice)}
                </span>
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform group-hover:scale-110">
                  {addingProductId === p.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Plus className="size-3" />
                  )}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      <Button
        variant="link"
        size="sm"
        className="mt-2 h-auto p-0 text-xs text-amber-700 hover:text-amber-900"
        onClick={() => navigate({ name: "shop" })}
      >
        Browse all products <ArrowRight className="ml-1 size-3" />
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CartSkeleton — premium shimmer loading state shown while the cart query
// resolves. Mirrors the real cart layout: line-item cards on the left (image
// + title + price + qty stepper) and a sticky order-summary card on the right.
// ---------------------------------------------------------------------------
export function CartSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Heading skeleton */}
      <div className="mb-4 h-8 w-32 skeleton-premium rounded" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items skeleton */}
        <div className="space-y-3 lg:col-span-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex gap-3 rounded-xl border border-border/50 p-3 shadow-premium-sm sm:gap-4 sm:p-4"
            >
              {/* Thumbnail */}
              <div className="size-20 shrink-0 rounded-lg skeleton-premium sm:size-24" />
              {/* Body */}
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 skeleton-premium rounded" />
                <div className="flex gap-2">
                  <div className="h-3 w-20 skeleton-premium rounded" />
                  <div className="h-3 w-16 skeleton-premium rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-20 skeleton-premium rounded" />
                  <div className="h-3 w-12 skeleton-premium rounded" />
                </div>
                {/* Qty stepper + remove */}
                <div className="flex items-center justify-between pt-2">
                  <div className="h-9 w-28 skeleton-premium rounded-lg" />
                  <div className="h-7 w-20 skeleton-premium rounded-lg" />
                </div>
              </div>
              {/* Line total — desktop only */}
              <div className="hidden flex-col items-end justify-between sm:flex">
                <div className="h-4 w-16 skeleton-premium rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Summary skeleton */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-3 rounded-xl border border-border/50 p-4 shadow-premium-sm">
            <div className="h-5 w-28 skeleton-premium rounded" />
            {/* Delivery / voucher placeholder */}
            <div className="h-16 w-full skeleton-premium rounded-lg" />
            <div className="flex gap-2">
              <div className="h-9 flex-1 skeleton-premium rounded-md" />
              <div className="h-9 w-24 skeleton-premium rounded-md" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-3.5 w-3/4 skeleton-premium rounded" />
              <div className="h-3.5 w-2/3 skeleton-premium rounded" />
              <div className="h-3.5 w-1/2 skeleton-premium rounded" />
              <div className="h-3.5 w-3/5 skeleton-premium rounded" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="h-5 w-16 skeleton-premium rounded" />
              <div className="h-6 w-24 skeleton-premium rounded" />
            </div>
            <div className="h-11 w-full skeleton-premium rounded-md" />
            <div className="flex justify-center gap-4 pt-1">
              <div className="h-3 w-20 skeleton-premium rounded" />
              <div className="h-3 w-20 skeleton-premium rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
