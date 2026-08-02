// ============================================================================
// File: src/components/customer/track-order-view.tsx
// Purpose: Order tracking page — modern animated vertical timeline showing
//          each fulfilment stage (placed -> confirmed -> [prescription verified]
//          -> preparing -> packed -> out for delivery -> nearby -> delivered)
//          with timestamps, a live ETA countdown banner, order summary, and
//          delivery address card. Invoice download + reorder actions.
// Role: Lets customers see exactly where their order is in the fulfilment flow.
// ============================================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk, OrderTrack } from "./api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  CheckCircle2,
  FileCheck,
  Package,
  Box,
  Truck,
  MapPin,
  Home,
  Clock,
  Download,
  Loader2,
  ChevronLeft,
  ClipboardList,
  FileText,
  RefreshCw,
  XCircle,
  Navigation,
  QrCode,
  Upload,
  Check,
  Info,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/constants";
import { motion } from "framer-motion";
import { ProductImage } from "@/components/shared/product-image";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

/** Extended order shape — the track endpoint also returns the QR image URL
 *  (only populated for paymentMethod="qr" orders) and the screenshot fields. */
interface OrderTrackWithQr extends OrderTrack {
  paymentQrImage?: string | null;
}

// ---------------------------------------------------------------------------
// Timeline stage definitions
// ---------------------------------------------------------------------------
type StageState = "complete" | "current" | "pending";

interface TimelineStage {
  key: string;
  label: string;
  icon: typeof Package;
  /** ISO timestamp shown when the stage is complete/current (if available). */
  timestamp?: string | null;
  state: StageState;
  /** Optional sub-note shown under the stage label. */
  hint?: string;
}

/** Build the list of timeline stages for an order. */
function buildStages(order: OrderTrack): TimelineStage[] {
  const flowIdx = ORDER_STATUS_FLOW.indexOf(order.status);
  const isCancelled = order.status === "cancelled" || order.status === "returned";
  if (isCancelled) return [];

  const stages: TimelineStage[] = [];

  // 1. Order Placed — completes as soon as the order leaves "pending".
  stages.push({
    key: "placed",
    label: "Order Placed",
    icon: ShoppingCart,
    timestamp: order.createdAt,
    state:
      flowIdx > 0
        ? "complete"
        : flowIdx === 0
          ? "current"
          : "pending",
  });

  // 2. Order Confirmed — completes when we move past "confirmed".
  stages.push({
    key: "confirmed",
    label: "Order Confirmed",
    icon: CheckCircle2,
    timestamp: order.confirmedAt,
    state:
      flowIdx > 1 ? "complete" : flowIdx === 1 ? "current" : "pending",
  });

  // 3. Prescription Verified — only shown for prescription orders.
  if (order.prescriptionId) {
    // Treat as complete once the order moves past "confirmed" (pharmacist has
    // verified the prescription before packing begins).
    stages.push({
      key: "rx_verified",
      label: "Prescription Verified",
      icon: FileCheck,
      timestamp: order.confirmedAt,
      state:
        flowIdx > 1 ? "complete" : flowIdx === 1 ? "current" : "pending",
      hint: "Our pharmacist reviewed your prescription",
    });
  }

  // 4. Preparing Order — sub-state during "confirmed" (between confirmed & packed).
  stages.push({
    key: "preparing",
    label: "Preparing Order",
    icon: Package,
    state:
      flowIdx > 2 ? "complete" : flowIdx === 2 ? "current" : flowIdx === 1 ? "current" : "pending",
    hint: flowIdx === 1 ? "Picking & checking your items" : undefined,
  });

  // 5. Packed — completes once we move past "packed".
  stages.push({
    key: "packed",
    label: "Packed",
    icon: Box,
    timestamp: order.packedAt,
    state:
      flowIdx > 3 ? "complete" : flowIdx === 3 ? "current" : "pending",
  });

  // 6. Out for Delivery.
  stages.push({
    key: "out_for_delivery",
    label: "Out for Delivery",
    icon: Truck,
    timestamp: order.outForDeliveryAt,
    state:
      flowIdx > 4 ? "complete" : flowIdx === 4 ? "current" : "pending",
  });

  // 7. Nearby Delivery Location — live sub-state of out-for-delivery.
  //    Current while the rider is en route; complete once delivered.
  if (flowIdx >= 4) {
    stages.push({
      key: "nearby",
      label: "Nearby Delivery Location",
      icon: MapPin,
      state:
        flowIdx > 4 ? "complete" : "current",
      hint:
        flowIdx === 4
          ? order.shipLocality
            ? `Rider is approaching ${order.shipLocality}`
            : "Rider is approaching your address"
          : undefined,
    });
  }

  // 8. Delivered.
  stages.push({
    key: "delivered",
    label: "Delivered",
    icon: Home,
    timestamp: order.deliveredAt,
    state:
      flowIdx > 4 ? "complete" : flowIdx === 4 ? "pending" : "pending",
  });

  // Special case: if the order is delivered, the "delivered" stage should be current/complete.
  if (order.status === "delivered") {
    const deliveredStage = stages.find((s) => s.key === "delivered");
    if (deliveredStage) deliveredStage.state = "complete";
    // Also mark "nearby" complete if it exists.
    const nearbyStage = stages.find((s) => s.key === "nearby");
    if (nearbyStage) nearbyStage.state = "complete";
  }

  return stages;
}

/** Live countdown hook — returns ms remaining until the target time.
 *  Updates every second. Returns null if the target has passed or is missing.
 *
 *  Implementation note: we keep `now` in state and update it from a
 *  `setInterval` callback (never synchronously inside the effect body — that
 *  would trigger the `react-hooks/set-state-in-effect` lint rule). The
 *  remaining time is derived from `now` + `targetIso` on every render. */
function useCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [targetIso]);
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - now;
  return diff > 0 ? diff : 0;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function TrackOrderView() {
  const view = useUI((s) => s.view);
  const navigate = useUI((s) => s.navigate);
  const back = useUI((s) => s.back);
  const setCartOpen = useUI((s) => s.setCartOpen);
  const qc = useQueryClient();
  const orderId = view.name === "track-order" ? view.orderId : "";

  const { data: order, isLoading } = useQuery({
    queryKey: qk.trackOrder(orderId),
    queryFn: () => api<OrderTrackWithQr>(`/api/orders/${orderId}/track`),
    enabled: !!orderId,
    staleTime: 10 * 1000, // Refresh after 10 seconds
    refetchInterval: 15 * 1000, // Auto-poll every 15 seconds for live status updates
  });

  const reorderMutation = useMutation({
    mutationFn: () =>
      api.post<{ added: number; skipped: string[]; totalItems: number }>(
        `/api/orders/${orderId}/reorder`
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.cart });
      if (data.added > 0 && data.skipped.length === 0) {
        toast.success(`Added ${data.added} item(s) to your cart`, {
          action: { label: "View cart", onClick: () => setCartOpen(true) },
        });
      } else if (data.added > 0 && data.skipped.length > 0) {
        toast.success(
          `Added ${data.added} item(s). ${data.skipped.length} unavailable.`,
          {
            description: `Unavailable: ${data.skipped.slice(0, 2).join(", ")}${data.skipped.length > 2 ? "…" : ""}`,
            action: { label: "View cart", onClick: () => setCartOpen(true) },
          }
        );
      } else {
        toast.error("None of the items are available to reorder");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDownload = async () => {
    try {
      const buf = await api.raw(`/api/invoice/${orderId}`);
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${order?.orderNumber ?? "order"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to download invoice";
      toast.error(msg);
    }
  };

  // Live countdown to estimated delivery
  const countdown = useCountdown(order?.estimatedDelivery);
  const isOutForDelivery = order?.status === "out_for_delivery";
  const isDelivered = order?.status === "delivered";
  const isCancelled =
    order?.status === "cancelled" || order?.status === "returned";

  // Build timeline stages (memoised so framer-motion stagger doesn't re-run)
  const stages = useMemo(() => (order ? buildStages(order) : []), [order]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-muted-foreground">Order not found.</p>
        <Button onClick={() => navigate({ name: "orders" })} className="mt-4">
          View my orders
        </Button>
      </div>
    );
  }

  const itemsCount = order.items.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <button
        onClick={back}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4 flex flex-wrap items-start justify-between gap-2"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
            {order.source === "prescription" && (
              <Badge variant="secondary" className="gap-1 bg-violet-100 text-violet-700">
                <FileText className="size-3" /> Prescription Order
              </Badge>
            )}
            {order.source === "manual_request" && (
              <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
                <ClipboardList className="size-3" /> Manual Request
              </Badge>
            )}
            {order.prescriptionId && (
              <Badge variant="outline" className="gap-1">
                <FileCheck className="size-3" /> Rx
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Badge variant={isCancelled ? "destructive" : "default"} className="text-sm">
          {ORDER_STATUS_LABEL[order.status] ?? order.status}
        </Badge>
      </motion.div>

      {/* ETA Banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mb-4"
      >
        {isCancelled ? (
          <Card className="border-destructive/30 bg-destructive/5 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <XCircle className="size-6" />
              </div>
              <div>
                <p className="font-semibold text-destructive">Order Cancelled</p>
                <p className="text-sm text-muted-foreground">
                  {order.statusHistory.find((h) => h.status === "cancelled")?.note ||
                    "This order was cancelled. Contact support if you have questions."}
                </p>
              </div>
            </div>
          </Card>
        ) : isDelivered ? (
          <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 14 }}
                className="flex size-11 items-center justify-center rounded-full bg-emerald-500 text-white"
              >
                <CheckCircle2 className="size-6" />
              </motion.div>
              <div>
                <p className="text-lg font-bold text-emerald-700">Delivered!</p>
                <p className="text-sm text-emerald-700/80">
                  Delivered on {order.deliveredAt ? formatDateTime(order.deliveredAt) : formatDateTime(order.createdAt)}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card
            className={`p-4 sm:p-5 ${
              isOutForDelivery
                ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50"
                : "border-primary/20 bg-gradient-to-r from-primary/5 to-accent/40"
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-11 items-center justify-center rounded-full ${
                    isOutForDelivery
                      ? "bg-emerald-500 text-white"
                      : "bg-primary text-primary-foreground"
                  } ${isOutForDelivery ? "animate-pulse" : ""}`}
                >
                  {isOutForDelivery ? (
                    <Truck className="size-6" />
                  ) : (
                    <Clock className="size-6" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isOutForDelivery ? "Out for delivery — arriving in" : "Estimated delivery"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.estimatedDelivery
                      ? `By ${formatDateTime(order.estimatedDelivery)}`
                      : "Estimated time will be updated soon"}
                  </p>
                </div>
              </div>
              {order.estimatedDelivery && countdown !== null && countdown > 0 && (
                <div className="text-center">
                  <div
                    className={`text-3xl font-bold tabular-nums ${
                      isOutForDelivery ? "text-emerald-600" : "text-primary"
                    }`}
                  >
                    {formatCountdown(countdown)}
                  </div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {isOutForDelivery ? "minutes:seconds" : "time remaining"}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}
      </motion.div>

      {/* QR Payment section — only shown when the order was placed with the QR
          payment method AND payment is still pending. Shows the QR image so the
          customer can scan & pay, plus either an upload form (no screenshot yet)
          or a "screenshot uploaded — awaiting verification" confirmation. */}
      {order.paymentMethod === "qr" && order.paymentStatus === "pending" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.07 }}
          className="mb-4"
        >
          <Card className="border-sky-200 bg-sky-50 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sky-900">
              <QrCode className="size-5" />
              <h2 className="text-sm font-semibold">Scan &amp; Pay (QR Code)</h2>
            </div>
            <p className="mt-1 text-xs text-sky-800">
              Pay <strong>{formatCurrency(order.grandTotal)}</strong> by scanning the QR code with
              any UPI app, then upload a screenshot of the payment confirmation so our team can
              verify it.
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
              {order.paymentQrImage ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={order.paymentQrImage}
                    alt="Payment QR code"
                    className="size-44 shrink-0 rounded-lg border border-sky-200 bg-white object-contain p-2"
                  />
                  <a
                    href={order.paymentQrImage}
                    download="payment-qr-code.png"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-700 px-3 text-[11px] font-medium text-white transition-colors hover:bg-sky-800"
                  >
                    <Download className="size-3.5" /> Download QR Code
                  </a>
                </div>
              ) : (
                <div className="flex size-44 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-white/60 p-3 text-center text-[11px] text-sky-800">
                  <span className="inline-flex items-start gap-1.5">
                    <Info className="size-3.5 shrink-0 mt-0.5" />
                    QR code not yet uploaded by the store. Our team will reach out with payment instructions.
                  </span>
                </div>
              )}

              <div className="flex-1">
                {order.paymentScreenshot ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Check className="size-4 text-emerald-600" />
                      Payment screenshot uploaded
                    </p>
                    <p className="mt-1 text-emerald-700">
                      Uploaded
                      {order.paymentScreenshotUploadedAt
                        ? ` on ${formatDateTime(order.paymentScreenshotUploadedAt)}`
                        : ""}
                      . Awaiting verification from our team.
                    </p>
                    {order.paymentTxnId && (
                      <p className="mt-1 text-emerald-700">
                        Transaction ID:{" "}
                        <span className="font-mono font-semibold">{order.paymentTxnId}</span>
                      </p>
                    )}
                    <div className="mt-2">
                      <img
                        src={order.paymentScreenshot}
                        alt="Uploaded payment screenshot"
                        className="max-h-40 rounded-md border border-emerald-200 bg-white object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <TrackPaymentUploader
                    orderId={order.id}
                    onUploaded={() => {
                      qc.invalidateQueries({ queryKey: qk.trackOrder(orderId) });
                    }}
                  />
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mb-4 p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <Navigation className="size-4 text-primary" /> Order Progress
          </h2>

          {isCancelled ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">This order was cancelled</p>
              <p className="mt-1 text-muted-foreground">
                {order.statusHistory.find((h) => h.status === "cancelled")?.note ||
                  "Order cancelled. Contact support if you have questions."}
              </p>
            </div>
          ) : (
            <ol className="relative">
              {stages.map((stage, idx) => {
                const Icon = stage.icon;
                const isComplete = stage.state === "complete";
                const isCurrent = stage.state === "current";
                const isLast = idx === stages.length - 1;
                const showTimestamp =
                  (isComplete || isCurrent) && stage.timestamp;

                // Connector line colour: emerald when next stage is complete or current;
                // animated gradient when current; muted when pending.
                const nextStage = stages[idx + 1];
                const connectorState = !nextStage
                  ? "none"
                  : nextStage.state === "complete"
                    ? "complete"
                    : nextStage.state === "current" || isCurrent
                      ? "active"
                      : "pending";

                return (
                  <motion.li
                    key={stage.key}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.08 }}
                    className="relative flex gap-3 pb-6 last:pb-0"
                  >
                    {/* Connector line */}
                    {!isLast && (
                      <span
                        className={`absolute left-[18px] top-9 h-[calc(100%-1.5rem)] w-0.5 ${
                          connectorState === "complete"
                            ? "bg-emerald-500"
                            : connectorState === "active"
                              ? "animate-pulse bg-gradient-to-b from-emerald-500 to-primary"
                              : "bg-accent"
                        }`}
                        aria-hidden
                      />
                    )}

                    {/* Icon circle */}
                    <span
                      className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        isComplete
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : isCurrent
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-accent bg-background text-muted-foreground"
                      } ${isCurrent ? "ring-4 ring-primary/20" : ""}`}
                    >
                      {isCurrent ? (
                        <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                      ) : null}
                      <Icon className={`size-4 ${isCurrent ? "animate-pulse" : ""}`} />
                    </span>

                    {/* Stage content */}
                    <div className="flex flex-1 flex-col pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm ${
                            isComplete || isCurrent
                              ? "font-semibold text-foreground"
                              : "font-medium text-muted-foreground"
                          }`}
                        >
                          {stage.label}
                        </span>
                        {isCurrent && (
                          <Badge className="bg-primary/10 text-primary">Current</Badge>
                        )}
                        {isComplete && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            <CheckCircle2 className="size-3" /> Done
                          </Badge>
                        )}
                      </div>
                      {showTimestamp && stage.timestamp ? (
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(stage.timestamp)}
                        </p>
                      ) : isComplete || isCurrent ? (
                        <p className="text-xs text-muted-foreground">In progress</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/70">Pending</p>
                      )}
                      {stage.hint && (isCurrent || isComplete) && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground">
                          {stage.hint}
                        </p>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </Card>
      </motion.div>

      {/* Order summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="mb-4 p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Order Summary</h2>
            <Badge variant="outline" className="gap-1">
              {itemsCount} {itemsCount === 1 ? "item" : "items"}
            </Badge>
          </div>

          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <ProductImage
                  name={item.name}
                  primaryImage={item.image}
                  size="sm"
                  className="!h-12 !w-12 rounded-md !text-base"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.qty} × {formatCurrency(item.mrp)}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="space-y-1.5 text-sm">
            <Row label="Items total" value={formatCurrency(order.itemsTotal)} />
            {order.productDiscount > 0 && (
              <Row
                label="Product discount"
                value={`- ${formatCurrency(order.productDiscount)}`}
                color="text-emerald-700"
              />
            )}
            {order.voucherDiscount > 0 && (
              <Row
                label={`Voucher${order.voucherCode ? ` (${order.voucherCode})` : ""}`}
                value={`- ${formatCurrency(order.voucherDiscount)}`}
                color="text-emerald-700"
              />
            )}
            {order.loyaltyDiscount > 0 && (
              <Row
                label={`Loyalty (${order.loyaltyPointsRedeemed ?? 0} pts)`}
                value={`- ${formatCurrency(order.loyaltyDiscount)}`}
                color="text-emerald-700"
              />
            )}
            <Row
              label="Delivery charge"
              value={
                order.deliveryCharge === 0
                  ? "FREE"
                  : formatCurrency(order.deliveryCharge)
              }
              color={
                order.deliveryCharge === 0
                  ? "text-emerald-700 font-medium"
                  : undefined
              }
            />
          </div>

          <Separator className="my-3" />

          <div className="flex items-center justify-between text-base font-bold">
            <span>Grand Total</span>
            <span className="text-primary">{formatCurrency(order.grandTotal)}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Payment:</span>
            <Badge variant="outline">
              {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
            </Badge>
            <Badge
              variant="outline"
              className={
                order.paymentStatus === "paid"
                  ? "border-emerald-300 text-emerald-700"
                  : ""
              }
            >
              {order.paymentStatus}
            </Badge>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={onDownload} variant="outline" className="flex-1 gap-1">
              <Download className="size-4" /> Download Invoice
            </Button>
            <Button
              onClick={() => reorderMutation.mutate()}
              disabled={reorderMutation.isPending}
              className="flex-1 gap-1"
            >
              {reorderMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Reorder
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Delivery address */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card className="mb-4 p-4 sm:p-6">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
            <MapPin className="size-5 text-primary" /> Delivery Address
          </h2>
          {order.shipLocality && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <MapPin className="size-3.5" /> Delivery Zone: {order.shipLocality}
            </div>
          )}
          <div className="text-sm">
            <p className="font-medium">{order.shipName}</p>
            <p className="text-muted-foreground">{order.shipPhone}</p>
            <p className="text-muted-foreground">{order.shipLine1}</p>
            {order.shipLine2 && <p className="text-muted-foreground">{order.shipLine2}</p>}
            <p className="text-muted-foreground">
              {order.shipCity}, {order.shipState} - {order.shipPincode}
            </p>
          </div>
        </Card>
      </motion.div>

      {order.notes && (
        <Card className="mb-4 p-4 sm:p-6">
          <h2 className="mb-1 text-base font-semibold">Order Notes</h2>
          <p className="text-sm text-muted-foreground">{order.notes}</p>
        </Card>
      )}

      <Button
        onClick={() => navigate({ name: "orders" })}
        variant="outline"
        className="mt-4 w-full gap-1"
      >
        <ChevronLeft className="size-4" /> Back to my orders
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={color ?? "font-medium"}>{value}</span>
    </div>
  );
}

/** Inline uploader for the payment screenshot on the track-order page. Posts
 *  multipart/form-data to /api/orders/[id]/payment-screenshot, then calls
 *  onUploaded so the parent refetches the order and swaps to the
 *  "screenshot uploaded" state. */
function TrackPaymentUploader({
  orderId,
  onUploaded,
}: {
  orderId: string;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [txnId, setTxnId] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedName, setSelectedName] = useState("");

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a screenshot to upload");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (txnId.trim()) form.append("txnId", txnId.trim());
      await api.upload<{ paymentScreenshot: string }>(
        `/api/orders/${orderId}/payment-screenshot`,
        form
      );
      toast.success("Payment screenshot uploaded");
      onUploaded();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to upload screenshot");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-sky-200 bg-white/70 p-3">
      <div className="flex items-center gap-2 text-sky-900">
        <Upload className="size-4" />
        <h3 className="text-xs font-semibold">Upload Payment Screenshot</h3>
      </div>
      <p className="mt-1 text-[11px] text-sky-800">
        Upload a clear screenshot of your UPI payment confirmation so we can verify your payment
        faster. PNG / JPG / WEBP up to 8 MB.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="tp-file" className="text-[11px] text-sky-900">Screenshot *</Label>
          <Input
            id="tp-file"
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setSelectedName(e.target.files?.[0]?.name ?? "")}
            className="h-9 text-xs"
          />
          {selectedName && (
            <p className="mt-0.5 text-[11px] text-sky-700 truncate">Selected: {selectedName}</p>
          )}
        </div>
        <div>
          <Label htmlFor="tp-txn" className="text-[11px] text-sky-900">Transaction ID (optional)</Label>
          <Input
            id="tp-txn"
            value={txnId}
            onChange={(e) => setTxnId(e.target.value)}
            placeholder="UPI ref no."
            className="h-9 text-xs"
          />
        </div>
      </div>
      <Button
        onClick={onUpload}
        disabled={busy}
        size="sm"
        className="mt-2 w-full gap-1 bg-sky-700 hover:bg-sky-800"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? "Uploading..." : "Upload screenshot"}
      </Button>
    </div>
  );
}
