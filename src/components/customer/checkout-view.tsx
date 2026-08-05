// ============================================================================
// File: src/components/customer/checkout-view.tsx
// Purpose: Checkout flow — address picker + add new address form, payment
//          method radio (COD/Online/UPI based on settings), order summary,
//          place order button. Enforces store-open + auth. On success
//          navigates to order-success.
// Role: Final step of the cart-to-order flow.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, Cart, Address, PublicSettings, LoyaltyInfo } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  MapPin,
  Plus,
  Check,
  Loader2,
  Lock,
  ArrowRight,
  Banknote,
  CreditCard,
  Smartphone,
  QrCode,
  Wallet,
  Building2,
  ShoppingBag,
  ShoppingCart,
  Home,
  Briefcase,
  MapPin as MapPinIcon,
  Truck,
  Clock,
  Zap,
  Gift,
  Pencil,
  X,
  ShieldCheck,
  Award,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { useRequireAuth } from "./use-require-auth";
import { useCustomer } from "./use-customer";
import { usePublicSettings } from "./use-public-settings";
import { formatCurrency } from "@/lib/format";
import { computeEarnablePoints } from "@/lib/loyalty";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Razorpay checkout script loader — loads the official Razorpay checkout.js
// script on demand (only when the customer picks the Razorpay method).
// Cached after the first load so subsequent checkouts don't re-fetch.
// ---------------------------------------------------------------------------
const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let razorpayScriptPromise: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      razorpayScriptPromise = null;
      reject(new Error("Failed to load Razorpay checkout script"));
    };
    document.head.appendChild(s);
  });
  return razorpayScriptPromise;
}

/** Delivery info shape returned by /api/delivery/calculate. Used as the local
 *  override for `cart.delivery` so the charge refreshes when the customer picks
 *  a non-default address. Includes `freeAbove` for the progress bar. */
interface DeliveryInfo {
  charge: number;
  free: boolean;
  zone?: string | null;
  zoneName?: string | null;
  estimatedHours?: number | null;
  serviceable?: boolean;
  message?: string | null;
  freeAbove?: number | null;
}

/** A small inline progress-bar for the free-delivery progress message. */
function FreeDeliveryProgress({ subtotal, freeAbove }: { subtotal: number; freeAbove: number }) {
  const pct = Math.min(100, Math.max(0, (subtotal / freeAbove) * 100));
  const remaining = Math.max(0, freeAbove - subtotal);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={remaining === 0 ? "font-semibold text-emerald-700" : "font-medium text-amber-800"}>
          {remaining === 0 ? "🎉 You've unlocked FREE Delivery!" : `Add ${formatCurrency(remaining)} more to unlock FREE Delivery`}
        </span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
        <div
          className={remaining === 0 ? "h-full bg-emerald-600" : "h-full bg-gradient-to-r from-amber-500 to-emerald-600"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CheckoutView() {
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const { customer } = useRequireAuth();
  const { settings, isStoreOpen } = usePublicSettings();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cod");
  const [notes, setNotes] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Auth gate
  if (!customer) {
    // useRequireAuth handles redirect in an effect
    return null;
  }

  return (
    <CheckoutViewInner
      customer={customer}
      settings={settings}
      isStoreOpen={isStoreOpen}
      selectedAddressId={selectedAddressId}
      setSelectedAddressId={setSelectedAddressId}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      notes={notes}
      setNotes={setNotes}
      showAddForm={showAddForm}
      setShowAddForm={setShowAddForm}
      navigate={navigate}
      qc={qc}
    />
  );
}

interface InnerProps {
  customer: { id: string; name: string; email: string; phone: string };
  settings: PublicSettings | undefined;
  isStoreOpen: boolean;
  selectedAddressId: string | null;
  setSelectedAddressId: (v: string | null) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  navigate: ReturnType<typeof useUI.getState>["navigate"];
  qc: ReturnType<typeof useQueryClient>;
}

function CheckoutViewInner(props: InnerProps) {
  const {
    customer,
    settings,
    isStoreOpen,
    selectedAddressId,
    setSelectedAddressId,
    paymentMethod,
    setPaymentMethod,
    notes,
    setNotes,
    showAddForm,
    setShowAddForm,
    navigate,
    qc,
  } = props;

  const { data: addresses, isLoading: addrLoading } = useQuery({
    queryKey: qk.addresses,
    queryFn: () => api<Address[]>("/api/customer/addresses"),
  });

  const { data: cart, isLoading: cartLoading } = useQuery({
    queryKey: qk.cart,
    queryFn: () => api<Cart>("/api/cart"),
  });

  // Loyalty balance — fetched in the background; used to power the
  // "redeem points at checkout" section in the order summary.
  const { data: loyalty } = useQuery({
    queryKey: qk.loyalty,
    queryFn: () => api<LoyaltyInfo>("/api/customer/loyalty"),
  });
  const loyaltyBalance = loyalty?.balance ?? 0;

  // Loyalty redemption state — `loyaltyInput` is the raw text the customer
  // is typing; `appliedLoyaltyPoints` is the integer that's actually been
  // applied to the order (set when the customer clicks "Apply").
  const [loyaltyInput, setLoyaltyInput] = useState("");
  const [appliedLoyaltyPoints, setAppliedLoyaltyPoints] = useState(0);

  // Local override for delivery info. When the customer picks a non-default
  // address, the cart's `delivery` block (computed for the default address)
  // is stale — so we re-query /api/delivery/calculate for the selected
  // address and store the fresh result here. `null` means "use cart.delivery".
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null);
  // Id of the address being edited inline (so only one editor shows at a time).
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // The "effective" delivery info — prefer the locally recalculated value
  // (which is fresh for the selected address), falling back to cart.delivery
  // (which is computed for the default address on the server).
  const effectiveDelivery: DeliveryInfo | null =
    deliveryInfo ?? (cart?.delivery ? { ...cart.delivery, freeAbove: cart.delivery.freeAbove ?? null } : null);

  // Derived: the discount and final total. The grand total is recalculated
  // locally using the effective delivery charge (which updates when the
  // customer selects a different address). This ensures the UI always shows
  // the correct total — no page refresh needed.
  //
  // Formula: (subtotalAfterVoucher - loyaltyDiscount) + deliveryCharge
  // The loyalty discount is capped at the cart's post-voucher subtotal
  // (NOT including delivery) to match the server-side pricing engine.
  const cartSubtotal = cart?.pricing?.totalAfterVoucher ?? 0;
  const appliedLoyaltyDiscount = Math.min(appliedLoyaltyPoints, cartSubtotal);
  const effectiveDeliveryCharge = effectiveDelivery?.charge ?? 0;
  const finalGrandTotal = Math.max(0, cartSubtotal - appliedLoyaltyDiscount + effectiveDeliveryCharge);

  // Derived: the currently selected address object (for the address picker
  // highlight + the delivery-info card header).
  const selectedAddress = addresses?.find((a) => a.id === selectedAddressId) ?? null;

  // Set default address on first load — MUST be in useEffect, not render phase,
  // to avoid "Cannot update a component while rendering a different component".
  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (def) setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  // Recalculate delivery whenever the customer picks a different address.
  // Skips the API call if there's no selection yet. Uses a ref to avoid
  // racing stale responses (older than the latest selection) overwriting
  // newer ones if the user clicks quickly between addresses.
  const lastReqId = useRef(0);
  useEffect(() => {
    if (!selectedAddress || !cart) return;
    const subtotal = cart.pricing.totalAfterVoucher;
    const reqId = ++lastReqId.current;
    setDeliveryInfo(null); // brief "recalculating" state
    fetch("/api/delivery/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locality: selectedAddress.locality,
        pincode: selectedAddress.pincode,
        subtotal,
      }),
    })
      .then((r) => r.json().catch(() => ({ ok: false })))
      .then((json) => {
        // Drop the response if a newer request superseded this one.
        if (reqId !== lastReqId.current) return;
        if (json?.ok && json.data) setDeliveryInfo(json.data as DeliveryInfo);
      })
      .catch(() => {
        // Silently fall back to cart.delivery — the server already set a
        // best-effort value for the default address.
      });
  }, [selectedAddressId, selectedAddress, cart]);

  // Set default payment method when settings load (pick the first active method)
  useEffect(() => {
    if (settings?.paymentMethods?.length && !settings.paymentMethods.some((p) => p.key === paymentMethod)) {
      setPaymentMethod(settings.paymentMethods[0].key);
    }
  }, [settings?.paymentMethods, paymentMethod]);

  // Apply loyalty points — validates input is a positive integer within
  // both the customer's balance AND the cart's post-voucher subtotal (the
  // server-side pricing engine caps loyalty at totalAfterVoucher, NOT at
  // grandTotal — loyalty cannot be redeemed against the delivery charge).
  const onApplyLoyalty = () => {
    const parsed = parseInt(loyaltyInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid number of points to redeem");
      setAppliedLoyaltyPoints(0);
      return;
    }
    if (parsed > loyaltyBalance) {
      toast.error(`You only have ${loyaltyBalance} loyalty points`);
      setAppliedLoyaltyPoints(0);
      return;
    }
    if (parsed > cartSubtotal) {
      toast.error(`You can redeem at most ${Math.floor(cartSubtotal)} points for this order`);
      setAppliedLoyaltyPoints(0);
      return;
    }
    setAppliedLoyaltyPoints(parsed);
    toast.success(`Applied ${parsed} loyalty points (− ${formatCurrency(parsed)})`);
  };

  const onRemoveLoyalty = () => {
    setAppliedLoyaltyPoints(0);
    setLoyaltyInput("");
  };

  // razorpayPlacingRef prevents double-clicks from creating duplicate
  // Razorpay orders while the modal is open. Resets when the modal closes
  // (success or dismissal).
  const razorpayPlacingRef = useRef(false);
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);

  // End-to-end Razorpay checkout helper. Loads the script, creates the
  // Razorpay order via our API, opens the modal, then verifies the payment
  // via our verify API. Throws on any failure (including user dismissal).
  async function runRazorpayCheckout(
    orderId: string,
    orderNumber: string
  ): Promise<void> {
    // 1. Load the Razorpay checkout script.
    await loadRazorpayScript();
    const RazorpayCtor = (window as any).Razorpay;
    if (!RazorpayCtor) {
      throw new Error("Razorpay checkout failed to load. Please try again.");
    }

    // 2. Create the Razorpay order on our server (which calls Razorpay).
    const rpayOrder = await api.post<{
      razorpayOrderId: string;
      amount: number;
      currency: string;
      keyId: string;
      orderId: string;
      orderNumber: string;
    }>("/api/checkout/razorpay", { orderId });

    // 3. Open the Razorpay checkout modal. Resolve/reject based on the
    //    handler / payment.failed / modal.ondismiss callbacks.
    await new Promise<void>((resolve, reject) => {
      const options: Record<string, unknown> = {
        key: rpayOrder.keyId,
        amount: rpayOrder.amount, // paise
        currency: rpayOrder.currency,
        name: settings?.store?.name || "Pharmacy",
        description: `Order ${orderNumber}`,
        order_id: rpayOrder.razorpayOrderId,
        // Prefill customer details for a smoother checkout.
        prefill: {
          name: customer.name,
          email: customer.email,
          contact: customer.phone,
        },
        notes: { pms_order_id: orderId, pms_order_number: orderNumber },
        theme: { color: "#0d9488" }, // teal-600 to match the app theme
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // 4. Verify the payment signature on our server.
          try {
            await api.post<{ success: true }>("/api/checkout/razorpay/verify", {
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              orderId,
            });
            resolve();
          } catch (e: unknown) {
            reject(
              e instanceof Error
                ? e
                : new Error("Payment verification failed")
            );
          }
        },
        modal: {
          ondismiss: () => {
            reject(new Error("Payment cancelled"));
          },
        },
      };
      const rzp = new RazorpayCtor(options);
      rzp.on("payment.failed", (resp: any) => {
        const reason = resp?.error?.description || "Payment failed";
        reject(new Error(reason));
      });
      rzp.open();
    });
  }

  // Place the PMS order (always) and, if the payment method is Razorpay,
  // open the Razorpay checkout modal to collect payment. The flow is:
  //   1. POST /api/checkout → creates the PMS order, returns orderId
  //   2. POST /api/checkout/razorpay → creates the Razorpay order, returns
  //      { razorpayOrderId, amount, currency, keyId }
  //   3. Open the Razorpay checkout modal with those details
  //   4. On success → POST /api/checkout/razorpay/verify → mark order paid
  //   5. Navigate to order-success
  // On any failure, the order remains in the DB with paymentStatus="pending"
  // and the customer can retry payment from the order history page (or admin
  // can manually mark it paid). The toast tells them what went wrong.
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const order = await api.post<{ id: string; orderNumber: string }>(
        "/api/checkout",
        {
          addressId: selectedAddressId,
          paymentMethod,
          notes: notes.trim() || undefined,
          loyaltyPoints: appliedLoyaltyPoints > 0 ? appliedLoyaltyPoints : undefined,
        }
      );
      return order;
    },
    onSuccess: async (order) => {
      qc.invalidateQueries({ queryKey: qk.cart });
      qc.invalidateQueries({ queryKey: qk.orders });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.loyalty });

      // Non-Razorpay methods: navigate straight to the success page.
      // COD shows "pay on delivery", QR shows the QR image — both are
      // displayed on the success page itself.
      if (paymentMethod !== "razorpay") {
        toast.success("Order placed successfully!");
        navigate({ name: "order-success", orderId: order.id });
        return;
      }

      // Razorpay flow — open the modal. Guard against double-initiation.
      if (razorpayPlacingRef.current) return;
      razorpayPlacingRef.current = true;
      setRazorpayModalOpen(true);
      try {
        await runRazorpayCheckout(order.id, order.orderNumber);
        // Verification succeeded → navigate to success.
        toast.success("Payment successful! Order confirmed.");
        navigate({ name: "order-success", orderId: order.id });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Payment failed or was cancelled";
        // Don't toast a scary error if the user simply dismissed the modal
        // (Razorpay returns "payment_cancelled" in that case).
        if (!/cancel/i.test(msg)) {
          toast.error(msg);
        }
        // Still navigate to the success page so the customer sees the order
        // was placed — they can retry payment from there / order history.
        // The order's paymentStatus remains "pending".
        toast.info("Order placed but payment is pending — you can retry from order history.");
        navigate({ name: "order-success", orderId: order.id });
      } finally {
        razorpayPlacingRef.current = false;
        setRazorpayModalOpen(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Show store-closed blocking state
  if (!isStoreOpen && settings) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Card className="border-amber-200 bg-amber-50 p-6 text-center">
          <Lock className="mx-auto mb-3 size-10 text-amber-600" />
          <h2 className="text-lg font-semibold text-amber-900">Store is currently closed</h2>
          <p className="mt-1 text-sm text-amber-800">{settings.store.closedMessage}</p>
          <Button onClick={() => navigate({ name: "cart" })} className="mt-4" variant="outline">
            Back to cart
          </Button>
        </Card>
      </div>
    );
  }

  if (cartLoading || addrLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Empty cart
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Add medicines to your cart before checking out."
          action={
            <Button onClick={() => navigate({ name: "shop" })} className="gap-2">
              Shop now <ArrowRight className="size-4" />
            </Button>
          }
        />
      </div>
    );
  }

  // Payment methods are now DB-managed (admin can add/enable/disable from Admin Panel).
  // The public settings API returns active methods with their icon names.
  const iconMap: Record<string, typeof Banknote> = {
    Banknote, CreditCard, Smartphone, QrCode, Wallet, Building2,
  };
  const availablePaymentMethods = (settings?.paymentMethods ?? []).map((pm) => ({
    value: pm.key,
    label: pm.label,
    icon: iconMap[pm.icon ?? ""] ?? Banknote,
    description: pm.description ?? "",
  }));

  const onPlaceOrder = () => {
    if (!selectedAddressId) {
      toast.error("Please select a delivery address");
      return;
    }
    // Validate that the selected payment method is in the available list.
    // If not (e.g. COD was disabled after the page loaded), auto-select the
    // first available method. If no methods are available, show an error.
    if (!availablePaymentMethods.some((m) => m.value === paymentMethod)) {
      if (availablePaymentMethods.length === 0) {
        toast.error("No payment methods available. Please contact support.");
        return;
      }
      // Auto-select the first available method
      setPaymentMethod(availablePaymentMethods[0].value);
      toast.info(`Payment method set to ${availablePaymentMethods[0].label}`);
      return; // Let the user confirm before placing the order
    }
    // Block re-entry while a Razorpay modal is open (avoid stacking modals).
    if (razorpayModalOpen) return;
    placeOrderMutation.mutate();
  };

  const pricing = cart.pricing;
  const totalQty = cart.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="mx-auto max-w-6xl overflow-x-hidden px-4 py-6 pb-28 sm:px-6 lg:pb-6">
      <h1 className="mb-2 text-2xl font-bold">Checkout</h1>

      {/* Step indicator — visual progress for the checkout flow */}
      <div className="mb-6 flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:size-9 sm:text-sm">
            1
          </div>
          <span className="text-xs font-medium text-foreground sm:text-sm">Address</span>
        </div>
        <div className="h-0.5 flex-1 bg-border" />
        <div className="flex items-center gap-2">
          <div className={`flex size-8 items-center justify-center rounded-full text-xs font-bold sm:size-9 sm:text-sm ${
            selectedAddressId
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}>
            2
          </div>
          <span className={`text-xs font-medium sm:text-sm ${
            selectedAddressId ? "text-foreground" : "text-muted-foreground"
          }`}>Payment</span>
        </div>
        <div className="h-0.5 flex-1 bg-border" />
        <div className="flex items-center gap-2">
          <div className={`flex size-8 items-center justify-center rounded-full text-xs font-bold sm:size-9 sm:text-sm ${
            paymentMethod
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}>
            3
          </div>
          <span className={`text-xs font-medium sm:text-sm ${
            paymentMethod ? "text-foreground" : "text-muted-foreground"
          }`}>Review</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Address section */}
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MapPin className="size-5 text-primary" /> Delivery Address
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm((v: boolean) => !v)}
                className="gap-1"
              >
                <Plus className="size-4" /> New
              </Button>
            </div>

            {showAddForm && (
              <AddressForm
                onSaved={() => {
                  setShowAddForm(false);
                  qc.invalidateQueries({ queryKey: qk.addresses });
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            {addrLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Loading addresses...</div>
            ) : addresses && addresses.length > 0 ? (
              <RadioGroup
                value={selectedAddressId ?? undefined}
                onValueChange={setSelectedAddressId}
                className="grid gap-2 sm:grid-cols-2"
              >
                {addresses.map((addr) => {
                  // Color-code the address card border by status:
                  //  - Default address → emerald border (visually promoted)
                  //  - Currently selected → primary border (action highlight)
                  //  - Editing in-place → primary border + ring
                  //  - Everything else → standard border
                  const isSelected = selectedAddressId === addr.id;
                  const isEditing = editingAddressId === addr.id;
                  const borderClass = isEditing
                    ? "border-primary ring-1 ring-primary/30"
                    : isSelected
                    ? "border-primary bg-accent/40"
                    : addr.isDefault
                    ? "border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70"
                    : "hover:bg-accent/30";

                  // Delivery estimate: for the selected address we have a real
                  // computed value from /api/delivery/calculate (effectiveDelivery.
                  // estimatedHours). For other addresses we fall back to a generic
                  // "~30–45 min" benchmark so every card shows an ETA.
                  const selectedEtaMin =
                    effectiveDelivery?.estimatedHours != null
                      ? Math.max(15, Math.round(effectiveDelivery.estimatedHours * 60))
                      : null;
                  const etaMin =
                    isSelected && selectedEtaMin != null
                      ? selectedEtaMin
                      : addr.isDefault && selectedEtaMin != null
                      ? selectedEtaMin // default typically matches the freshly-loaded cart delivery
                      : 30; // generic estimate for unselected addresses

                  return (
                    <div
                      key={addr.id}
                      className={`relative flex items-start gap-3 rounded-lg border p-3 transition-colors ${borderClass}`}
                    >
                      <RadioGroupItem
                        value={addr.id}
                        id={addr.id}
                        className="mt-1"
                        disabled={isEditing}
                      />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <EditAddressForm
                            address={addr}
                            onSaved={() => {
                              setEditingAddressId(null);
                              qc.invalidateQueries({ queryKey: qk.addresses });
                            }}
                            onCancel={() => setEditingAddressId(null)}
                          />
                        ) : (
                          <>
                            <Label htmlFor={addr.id} className="block cursor-pointer">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <AddressLabelIcon label={addr.label} />
                                <span className="text-sm font-semibold">{addr.label}</span>
                                {addr.isDefault && (
                                  <Badge className="gap-1 bg-emerald-600 text-white shadow-sm">
                                    <Check className="size-3" /> Default
                                  </Badge>
                                )}
                              </div>
                              <p className="flex items-start gap-1.5 text-sm text-foreground">
                                <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                <span>{addr.line1}</span>
                              </p>
                              {addr.line2 && (
                                <p className="pl-5 text-sm text-muted-foreground">{addr.line2}</p>
                              )}
                              <p className="pl-5 text-sm text-muted-foreground">
                                {addr.city}, {addr.state} - {addr.pincode}
                              </p>
                              {addr.locality && (
                                <p className="pl-5 text-xs text-muted-foreground">Locality: {addr.locality}</p>
                              )}
                              {addr.phone && (
                                <p className="mt-1 pl-5 text-xs text-muted-foreground">Phone: {addr.phone}</p>
                              )}
                              {/* ETA chip — gives the customer a quick "how long?"
                                  estimate per address without opening the delivery
                                  info card below. Uses the real computed ETA for the
                                  selected address, generic 30-min estimate otherwise. */}
                              <div className="mt-2 pl-5">
                                <Badge
                                  variant="outline"
                                  className={`gap-1 ${
                                    isSelected
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                      : "border-amber-200 bg-amber-50 text-amber-700"
                                  } text-[10px] font-medium`}
                                >
                                  <Clock className="size-3" />
                                  Delivers in ~{etaMin} min
                                </Badge>
                              </div>
                            </Label>
                            <div className="mt-2 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingAddressId(addr.id);
                                }}
                              >
                                <Pencil className="size-3" /> Edit
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No saved addresses yet. Add a new address above.
              </p>
            )}
          </Card>

          {/* Delivery info — uses the locally recalculated `effectiveDelivery`
              (refreshed whenever the selected address changes via
              /api/delivery/calculate), with a graceful fallback to the
              cart.delivery block (which is computed server-side for the
              customer's default address). */}
          {effectiveDelivery && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="gap-3 border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Truck className="size-5 text-primary" />
                  <h2 className="text-base font-semibold">
                    Delivery{selectedAddress ? ` to ${selectedAddress.pincode}` : ""}
                  </h2>
                  {!deliveryInfo && (
                    <span className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> recalculating…
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {effectiveDelivery.zoneName ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <Zap className="mr-1 size-3" /> {effectiveDelivery.zoneName}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Standard Delivery</Badge>
                    )}
                    {effectiveDelivery.free ? (
                      <Badge className="bg-emerald-600 text-white">FREE Delivery</Badge>
                    ) : (
                      <Badge variant="outline">
                        {formatCurrency(effectiveDelivery.charge ?? 0)} delivery charge
                      </Badge>
                    )}
                  </div>
                  {effectiveDelivery.estimatedHours != null && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span>
                        {effectiveDelivery.estimatedHours < 1
                          ? `Estimated delivery in ${Math.max(15, Math.round(effectiveDelivery.estimatedHours * 60))} minutes`
                          : `Estimated delivery in ${effectiveDelivery.estimatedHours} hour${effectiveDelivery.estimatedHours === 1 ? "" : "s"}`
                        }
                      </span>
                    </div>
                  )}
                  {effectiveDelivery.message && (
                    <p className="text-xs text-muted-foreground">{effectiveDelivery.message}</p>
                  )}
                  {effectiveDelivery.serviceable === false && (
                    <p className="text-xs text-destructive">
                      Delivery is not available to the selected address — please
                      choose another address or contact support.
                    </p>
                  )}
                  {/* Free-delivery progress message — only show when the zone has
                      a `freeAbove` threshold set AND the cart subtotal is below it. */}
                  {effectiveDelivery.freeAbove != null &&
                    effectiveDelivery.freeAbove > 0 &&
                    effectiveDelivery.serviceable !== false &&
                    pricing.totalAfterVoucher < effectiveDelivery.freeAbove && (
                      <div className="rounded-md border border-amber-200 bg-amber-50/70 p-2.5">
                        <FreeDeliveryProgress
                          subtotal={pricing.totalAfterVoucher}
                          freeAbove={effectiveDelivery.freeAbove}
                        />
                      </div>
                    )}
                  {effectiveDelivery.freeAbove != null &&
                    effectiveDelivery.freeAbove > 0 &&
                    effectiveDelivery.serviceable !== false &&
                    pricing.totalAfterVoucher >= effectiveDelivery.freeAbove && (
                      <p className="text-xs font-medium text-emerald-700">
                        🎉 You&apos;ve unlocked FREE Delivery!
                      </p>
                    )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Payment method */}
          <Card className="gap-3 p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CreditCard className="size-5 text-primary" /> Payment Method
            </h2>

            {/* Trust strip —Drug License + GST + SSL + Secure badges.
                Rendered inline above the payment options so the customer
                sees pharmacy credibility right before sharing payment
                details. Uses settings.store.licenseNumber when available. */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:grid-cols-4">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-800 dark:text-emerald-200">Drug License</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-800 dark:text-emerald-200">GST Registered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-800 dark:text-emerald-200">SSL Secured</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-800 dark:text-emerald-200">Fast Delivery</span>
              </div>
            </div>
            {settings?.store?.licenseNumber && (
              <p className="text-[11px] text-muted-foreground">
                Licensed pharmacy · Drug License #:{" "}
                <span className="font-medium text-foreground">{settings.store.licenseNumber}</span>
              </p>
            )}

            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-2">
              {availablePaymentMethods.map((m) => {
                const Icon = m.icon;
                return (
                  <Label
                    key={m.value}
                    htmlFor={`pm-${m.value}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      paymentMethod === m.value ? "border-primary bg-accent/40" : "hover:bg-accent/30"
                    }`}
                  >
                    <RadioGroupItem value={m.value} id={`pm-${m.value}`} className="mt-1" />
                    <Icon className="mt-0.5 size-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
          </Card>

          {/* Notes */}
          <Card className="gap-2 p-4">
            <Label htmlFor="notes" className="text-base font-semibold">
              Order Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Any special instructions for delivery or pharmacist..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </Card>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <Card className="gap-3 overflow-hidden p-0 py-0 lg:sticky lg:top-20">
            {/* Gradient header with shopping-cart icon + item count badge */}
            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5" />
                <h2 className="text-base font-semibold">Order Summary</h2>
              </div>
              <Badge className="bg-white/20 text-white hover:bg-white/20">
                {totalQty} {totalQty === 1 ? "item" : "items"}
              </Badge>
            </div>

            <div className="flex flex-col gap-3 p-4">
            {/* Items */}
            <div className="max-h-48 space-y-2 overflow-y-auto scrollbar-thin">
              {cart.items.map((item) => (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded bg-accent text-xs font-bold text-muted-foreground">
                    {item.quantity}x
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    {/* Mobile-first: 2-line clamp with break-words prevents long
                        product titles from overflowing the checkout card.
                        `break-words` handles extremely long single words (e.g.,
                        chemical names), while `line-clamp-2` caps to 2 lines
                        with an ellipsis. The `title` attr shows the full name
                        on hover/long-press for accessibility. */}
                    <p
                      className="line-clamp-2 break-words text-xs font-medium leading-tight"
                      title={item.product.name}
                    >
                      {item.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.product.sellingPrice)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">
                    {formatCurrency(item.product.sellingPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1.5 text-sm">
              <SummaryRow
                label={`Item Total (MRP)${totalQty > 0 ? ` · ${totalQty} ${totalQty === 1 ? "item" : "items"}` : ""}`}
                value={formatCurrency(pricing.itemsTotal)}
              />
              {pricing.productDiscount > 0 && (
                <SummaryRow
                  label="Product Discount"
                  value={`- ${formatCurrency(pricing.productDiscount)}`}
                  color="text-emerald-700"
                />
              )}
              {/* "After Discount Amount" — the subtotal after product-level
                  discounts. When a voucher is applied we show the post-voucher
                  subtotal (pricing.totalAfterVoucher) so the math reads
                  cleanly: MRP − Product Discount − Voucher = shown value.
                  Otherwise we show pricing.subtotalAfterDiscount. */}
              <SummaryRow
                label="After Discount Amount"
                value={formatCurrency(
                  pricing.voucherDiscount > 0
                    ? pricing.totalAfterVoucher
                    : pricing.subtotalAfterDiscount,
                )}
                color="font-medium"
              />
              {pricing.voucherDiscount > 0 && (
                <SummaryRow
                  label={`Voucher Discount${pricing.voucherCode ? ` (${pricing.voucherCode})` : ""}`}
                  value={`- ${formatCurrency(pricing.voucherDiscount)}`}
                  color="text-emerald-700"
                />
              )}
              {appliedLoyaltyDiscount > 0 && (
                <SummaryRow
                  label={`Loyalty Points Discount (${appliedLoyaltyPoints} pts)`}
                  value={`- ${formatCurrency(appliedLoyaltyDiscount)}`}
                  color="text-amber-700"
                />
              )}
              <SummaryRow
                label="Delivery Charges"
                value={
                  effectiveDelivery?.free
                    ? "FREE"
                    : formatCurrency(effectiveDeliveryCharge)
                }
                color={effectiveDelivery?.free ? "text-emerald-700 font-semibold" : undefined}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2.5 text-base font-bold">
              <span className="text-primary">Grand Total</span>
              <span className="text-primary">{formatCurrency(finalGrandTotal)}</span>
            </div>

            {/* "You'll earn X points" hint — based on the FINAL grand total
                (after any loyalty redemption). Only shown when points > 0. */}
            {(() => {
              const earnable = computeEarnablePoints(finalGrandTotal);
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

            {/* "Payment" section divider — separates the totals from the
                payment-related area (loyalty redemption + place-order CTA). */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <CreditCard className="size-3" /> Payment
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Loyalty redemption — only shown if the customer has points. */}
            {loyaltyBalance > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
                  <Gift className="size-4 text-amber-600" />
                  <span>
                    You have {loyaltyBalance.toLocaleString("en-IN")} loyalty points
                    <span className="font-normal text-amber-700">
                      {" "}(worth {formatCurrency(loyaltyBalance)})
                    </span>
                  </span>
                </div>
                {appliedLoyaltyPoints > 0 ? (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-white p-2 text-sm">
                    <span>
                      <Badge className="mr-2 bg-amber-100 text-amber-800">
                        −{appliedLoyaltyPoints} pts
                      </Badge>
                      <span className="text-muted-foreground">
                        Saving {formatCurrency(appliedLoyaltyDiscount)}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onRemoveLoyalty}
                      className="h-7 px-2 text-xs text-muted-foreground"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={Math.min(loyaltyBalance, Math.floor(cartSubtotal))}
                      placeholder="Points to redeem"
                      value={loyaltyInput}
                      onChange={(e) => setLoyaltyInput(e.target.value)}
                      className="h-9 bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onApplyLoyalty}
                      disabled={!loyaltyInput}
                      className="border-amber-300 text-amber-800 hover:bg-amber-100"
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button
              size="lg"
              className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg hover:shadow-emerald-600/30"
              onClick={onPlaceOrder}
              disabled={placeOrderMutation.isPending || !selectedAddressId || razorpayModalOpen}
            >
              {placeOrderMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {paymentMethod === "razorpay" ? "Opening Razorpay..." : "Placing order..."}
                </>
              ) : (
                <>
                  <Check className="size-4" /> Place order — {formatCurrency(finalGrandTotal)}
                </>
              )}
            </Button>

            <p className="hidden text-center text-xs text-muted-foreground lg:block">
              <Lock className="mr-1 inline size-3" />
              Your data is safe and encrypted
            </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Mobile sticky bottom CTA bar — shows grand total + Place Order button.
          Always visible on mobile so the user can place the order without
          scrolling to the bottom of the inline order-summary card. The desktop
          layout uses the inline button inside the sticky right-hand summary
          card, so this bar is `lg:hidden`. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Grand Total
            </p>
            <p className="truncate text-lg font-bold leading-tight text-primary">
              {formatCurrency(finalGrandTotal)}
            </p>
          </div>
          <Button
            size="lg"
            className="shrink-0 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
            onClick={onPlaceOrder}
            disabled={placeOrderMutation.isPending || !selectedAddressId || razorpayModalOpen}
          >
            {placeOrderMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            <span className="whitespace-nowrap">
              {placeOrderMutation.isPending
                ? paymentMethod === "razorpay"
                  ? "Opening..."
                  : "Placing..."
                : "Place Order"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={color ?? "font-medium"}>{value}</span>
    </div>
  );
}

function AddressLabelIcon({ label }: { label: string }) {
  const Icon = label.toLowerCase() === "work" ? Briefcase : label.toLowerCase() === "office" ? Briefcase : Home;
  return <Icon className="size-4 text-muted-foreground" />;
}

// Inline new-address form
function AddressForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { customer } = useCustomer();
  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("Mathura");
  // District is no longer editable — always defaulted to "Mathura" on save.
  const [state, setState] = useState("Uttar Pradesh");
  const [pincode, setPincode] = useState("");
  const [locality, setLocality] = useState("");
  const [phone, setPhone] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-fill the phone field with the customer's registered mobile number —
  // saves them typing on the first address. Only runs once, when the form
  // mounts and the customer is loaded (and the field hasn't been touched).
  useEffect(() => {
    if (customer?.phone && !phone) setPhone(customer.phone);
  }, [customer?.phone, phone]);

  // Fetch the list of localities from active delivery zones — powers the
  // Locality / Area dropdown. Delivery charges depend on this value.
  const { data: localitiesData } = useQuery({
    queryKey: ["customer", "delivery-localities"],
    queryFn: () => api<{ localities: string[] }>("/api/delivery/localities"),
  });
  const localities = localitiesData?.localities ?? [];

  const onSave = async () => {
    if (!line1 || !pincode) {
      toast.error("Address line and pincode are required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    if (!locality) {
      toast.error("Please select your area / locality");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/customer/addresses", {
        label,
        line1,
        line2,
        city,
        district: "Mathura",
        state,
        pincode,
        locality,
        phone: phone.trim(),
        isDefault,
      });
      toast.success("Address added");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 rounded-lg border bg-accent/20 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="addr-label" className="text-xs">Label</Label>
          <Input id="addr-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home / Work / Office" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="addr-line1" className="text-xs">Address line 1 *</Label>
          <Input id="addr-line1" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="House no, street, area" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="addr-line2" className="text-xs">Address line 2</Label>
          <Input id="addr-line2" value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Landmark, etc." />
        </div>
        <div>
          <Label htmlFor="addr-city" className="text-xs">City</Label>
          <Input id="addr-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="addr-pincode" className="text-xs">Pincode *</Label>
          <Input id="addr-pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="281001" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="addr-locality" className="text-xs">Locality / Area *</Label>
          <Select value={locality} onValueChange={setLocality}>
            <SelectTrigger id="addr-locality">
              <SelectValue placeholder="Select your area" />
            </SelectTrigger>
            <SelectContent>
              {localities.length === 0 ? (
                <SelectItem value="__none__" disabled>No areas configured</SelectItem>
              ) : (
                localities.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Required — used to calculate accurate delivery charges</p>
        </div>
        <div>
          <Label htmlFor="addr-state" className="text-xs">State</Label>
          <Input id="addr-state" value={state} onChange={(e) => setState(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="addr-phone" className="text-xs">Mobile Number *</Label>
          <Input id="addr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" required />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="addr-default"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <Label htmlFor="addr-default" className="text-sm cursor-pointer">Make this my default address</Label>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Save address"}
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm">
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}

// Inline edit-address form — renders inside the address card (no dialog) so the
// customer can tweak a saved address without leaving the checkout flow. Calls
// PUT /api/customer/addresses/[id] on save. After save, the parent refetches
// the addresses list and the edited address stays selected (its id is
// preserved on update).
function EditAddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address: Address;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(address.label);
  const [line1, setLine1] = useState(address.line1);
  const [line2, setLine2] = useState(address.line2 ?? "");
  const [city, setCity] = useState(address.city);
  // District is no longer editable — always defaulted to "Mathura" on save.
  const [state, setState] = useState(address.state);
  const [pincode, setPincode] = useState(address.pincode);
  const [locality, setLocality] = useState(address.locality ?? "");
  const [phone, setPhone] = useState(address.phone ?? "");
  const [saving, setSaving] = useState(false);

  // Fetch the list of localities from active delivery zones — powers the
  // Locality / Area dropdown. Delivery charges depend on this value.
  const { data: localitiesData } = useQuery({
    queryKey: ["customer", "delivery-localities"],
    queryFn: () => api<{ localities: string[] }>("/api/delivery/localities"),
  });
  const localities = localitiesData?.localities ?? [];

  const onSave = async () => {
    if (!line1 || !pincode) {
      toast.error("Address line and pincode are required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    if (!locality) {
      toast.error("Please select your area / locality");
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/customer/addresses/${address.id}`, {
        label,
        line1,
        line2: line2 || undefined,
        city,
        district: "Mathura",
        state,
        pincode,
        locality,
        phone: phone.trim(),
      });
      toast.success("Address updated");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="grid gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Edit address
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={(e) => {
            e.preventDefault();
            onCancel();
          }}
          aria-label="Cancel edit"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`edit-addr-label-${address.id}`} className="text-xs">Label</Label>
          <Input
            id={`edit-addr-label-${address.id}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Home / Work / Office"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`edit-addr-line1-${address.id}`} className="text-xs">Address line 1 *</Label>
          <Input
            id={`edit-addr-line1-${address.id}`}
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="House no, street, area"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`edit-addr-line2-${address.id}`} className="text-xs">Address line 2</Label>
          <Input
            id={`edit-addr-line2-${address.id}`}
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            placeholder="Landmark, etc."
          />
        </div>
        <div>
          <Label htmlFor={`edit-addr-city-${address.id}`} className="text-xs">City</Label>
          <Input
            id={`edit-addr-city-${address.id}`}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`edit-addr-pincode-${address.id}`} className="text-xs">Pincode *</Label>
          <Input
            id={`edit-addr-pincode-${address.id}`}
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="281001"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`edit-addr-locality-${address.id}`} className="text-xs">Locality / Area *</Label>
          <Select value={locality} onValueChange={setLocality}>
            <SelectTrigger id={`edit-addr-locality-${address.id}`}>
              <SelectValue placeholder="Select your area" />
            </SelectTrigger>
            <SelectContent>
              {localities.length === 0 ? (
                <SelectItem value="__none__" disabled>No areas configured</SelectItem>
              ) : (
                localities.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Required — used to calculate accurate delivery charges</p>
        </div>
        <div>
          <Label htmlFor={`edit-addr-state-${address.id}`} className="text-xs">State</Label>
          <Input
            id={`edit-addr-state-${address.id}`}
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`edit-addr-phone-${address.id}`} className="text-xs">Mobile Number *</Label>
          <Input
            id={`edit-addr-phone-${address.id}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            required
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm">
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
