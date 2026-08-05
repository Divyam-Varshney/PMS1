// ============================================================================
// File: src/components/customer/cart-sheet.tsx
// Purpose: Slide-in cart drawer (right side) for quick view + edit of cart
//          without leaving the current page. Uses the Sheet primitive.
// Role: Triggered from the header/bottom-nav cart icon. Lets customers
//       adjust qty, remove items, apply voucher, and proceed to checkout.
// ============================================================================

"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag, Loader2, Tag, X, ArrowRight } from "lucide-react";
import { useUI } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, Cart } from "./api";
import { ProductImage } from "@/components/shared/product-image";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";

export function CartSheet() {
  const cartOpen = useUI((s) => s.cartOpen);
  const setCartOpen = useUI((s) => s.setCartOpen);
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const [voucherInput, setVoucherInput] = useState("");
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  const { data: cart, isLoading } = useQuery({
    queryKey: qk.cart,
    queryFn: () => api<Cart>("/api/cart"),
    enabled: cartOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { productId: string; qty: number }) =>
      api.post<Cart>("/api/cart/update", vars),
    onSuccess: (data) => qc.setQueryData(qk.cart, data),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.post<Cart>("/api/cart/remove", { productId }),
    onSuccess: (data) => {
      qc.setQueryData(qk.cart, data);
      qc.invalidateQueries({ queryKey: qk.cart });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyVoucherMutation = useMutation({
    mutationFn: (code: string) => api.post<Cart>("/api/cart/voucher", { code }),
    onMutate: () => setApplyingVoucher(true),
    onSuccess: (data) => {
      qc.setQueryData(qk.cart, data);
      toast.success("Voucher applied");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setApplyingVoucher(false),
  });

  const removeVoucherMutation = useMutation({
    mutationFn: () => api.del<Cart>("/api/cart/voucher"),
    onSuccess: (data) => {
      qc.setQueryData(qk.cart, data);
      toast.success("Voucher removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const goCheckout = () => {
    setCartOpen(false);
    navigate({ name: "checkout" });
  };

  const goShop = () => {
    setCartOpen(false);
    navigate({ name: "shop" });
  };

  const items = cart?.items ?? [];
  const pricing = cart?.pricing;
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            Your Cart
            {totalQty > 0 && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {totalQty}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">Review items in your cart</SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty"
              description="Browse our catalog and add medicines to your cart."
              action={
                <Button onClick={goShop} className="gap-2">
                  <ArrowRight className="size-4" /> Start Shopping
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const line = pricing?.lines.find((l) => l.productId === item.productId);
                const effectivePrice = line?.finalLineTotal
                  ? line.finalLineTotal / item.quantity
                  : item.product.sellingPrice;
                return (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-lg border bg-card p-3"
                  >
                    <button
                      onClick={() => {
                        setCartOpen(false);
                        navigate({ name: "product", productId: item.productId, slug: item.product.slug });
                      }}
                      className="shrink-0"
                    >
                      <ProductImage
                        name={item.product.name}
                        primaryImage={item.product.primaryImage}
                        size="md"
                        className="!h-16 !w-16 rounded-md !text-2xl"
                      />
                    </button>
                    <div className="flex flex-1 flex-col">
                      <button
                        onClick={() => {
                          setCartOpen(false);
                          navigate({ name: "product", productId: item.productId, slug: item.product.slug });
                        }}
                        className="line-clamp-2 break-words text-left text-sm font-medium hover:text-primary"
                      >
                        {item.product.name}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {item.product.unit && <span>{item.product.unit}</span>}
                        {item.product.packSize && <span>• {item.product.packSize}</span>}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold">
                          {formatCurrency(effectivePrice)}
                        </span>
                        {item.product.mrp > item.product.sellingPrice && (
                          <span className="text-[11px] text-muted-foreground line-through">
                            {formatCurrency(item.product.mrp)}
                          </span>
                        )}
                      </div>

                      {/* Qty stepper + remove */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-md border">
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                productId: item.productId,
                                qty: item.quantity - 1,
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="flex size-7 items-center justify-center hover:bg-accent"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                productId: item.productId,
                                qty: item.quantity + 1,
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="flex size-7 items-center justify-center hover:bg-accent"
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeMutation.mutate(item.productId)}
                          disabled={removeMutation.isPending}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: voucher + totals + checkout */}
        {items.length > 0 && pricing && (
          <SheetFooter className="border-t p-4">
            {/* Voucher */}
            {cart?.voucherCode && pricing.voucherValid ? (
              <div className="mb-3 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
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
              <div className="mb-3 flex gap-2">
                <Input
                  placeholder="Voucher code"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                  className="h-9 uppercase"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!voucherInput || applyingVoucher}
                  onClick={() => {
                    if (voucherInput) applyVoucherMutation.mutate(voucherInput);
                  }}
                >
                  {applyingVoucher ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            )}

            {/* Totals */}
            <div className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Items ({totalQty})</span>
                <span>{formatCurrency(pricing.itemsTotal)}</span>
              </div>
              {pricing.productDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Product discount</span>
                  <span>- {formatCurrency(pricing.productDiscount)}</span>
                </div>
              )}
              {pricing.voucherDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Voucher discount</span>
                  <span>- {formatCurrency(pricing.voucherDiscount)}</span>
                </div>
              )}
              {pricing.voucherError && (
                <div className="text-xs text-destructive">{pricing.voucherError}</div>
              )}
              {cart?.delivery && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery</span>
                  <span>
                    {cart.delivery.free ? (
                      <span className="font-medium text-emerald-700">FREE</span>
                    ) : (
                      formatCurrency(cart.delivery.charge)
                    )}
                  </span>
                </div>
              )}
            </div>
            <Separator className="mb-3" />
            <div className="mb-3 flex items-center justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(cart?.grandTotal ?? 0)}</span>
            </div>

            <Button onClick={goCheckout} size="lg" className="w-full gap-2">
              Checkout <ArrowRight className="size-4" />
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
