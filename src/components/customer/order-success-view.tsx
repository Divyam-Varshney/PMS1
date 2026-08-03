// ============================================================================
// File: src/components/customer/order-success-view.tsx
// Purpose: Post-checkout success screen. Animated checkmark, order number,
//          estimated delivery, track order + continue shopping buttons.
//          When the order was placed with the QR payment method, also shows
//          the QR code image so the customer can scan & pay — and an upload
//          form to submit a payment screenshot so the admin can verify receipt.
// Role: Confirmation page shown after a successful order placement.
// ============================================================================

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, OrderTrack } from "./api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Package,
  Truck,
  ArrowRight,
  Loader2,
  Home,
  ShoppingBag,
  QrCode,
  Info,
  Upload,
  Check,
  Download,
} from "lucide-react";
import { useUI } from "@/lib/store";
import { motion } from "framer-motion";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useRef, useState } from "react";

/** Extended order shape — the track endpoint now also returns paymentQrImage
 *  (only populated for paymentMethod="qr" orders) and the screenshot fields. */
interface OrderTrackWithQr extends OrderTrack {
  paymentQrImage?: string | null;
}

export function OrderSuccessView() {
  const view = useUI((s) => s.view);
  const navigate = useUI((s) => s.navigate);
  const qc = useQueryClient();
  const orderId = view.name === "order-success" ? view.orderId : "";

  const { data: order, isLoading } = useQuery({
    queryKey: ["customer", "order-success", orderId],
    queryFn: () => api<OrderTrackWithQr>(`/api/orders/${orderId}/track`),
    enabled: !!orderId,
  });

  const isQrOrder = order?.paymentMethod === "qr";
  const qrImage = order?.paymentQrImage ?? null;
  const screenshotUploaded = !!order?.paymentScreenshot;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Animated check */}
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-4 flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
        >
          <CheckCircle2 className="size-12" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold sm:text-3xl"
        >
          Order placed successfully!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-1 text-sm text-muted-foreground"
        >
          Thank you for your order. We&apos;ll send you a confirmation email shortly.
        </motion.p>
      </div>

      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : order ? (
        <Card className="mt-8 gap-3 p-5">
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Order Number</p>
              <p className="text-base font-bold">{order.orderNumber}</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-xs text-muted-foreground">Order Total</p>
              <p className="text-base font-bold text-primary">{formatCurrency(order.grandTotal)}</p>
            </div>
          </div>

          <div className="rounded-lg bg-accent/40 p-3 text-sm">
            <p className="flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              <span className="font-medium">Estimated delivery:</span>
              <span>
                {order.estimatedDelivery
                  ? formatDateTime(order.estimatedDelivery)
                  : "Within 24 hours"}
              </span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Package className="size-4" />
              <span>{order.items.length} item(s) • Payment: {order.paymentMethod.toUpperCase()}</span>
            </p>
          </div>

          {/* QR Code payment instructions + screenshot upload — only shown for QR orders. */}
          {isQrOrder && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-sky-200 bg-sky-50 p-4"
            >
              <div className="flex items-center gap-2 text-sky-900">
                <QrCode className="size-5" />
                <h3 className="text-sm font-semibold">Scan &amp; Pay (QR Code)</h3>
              </div>
              <p className="mt-1 text-xs text-sky-800">
                Scan the QR code below with any UPI app (Google Pay, PhonePe, Paytm) to pay
                <strong> {formatCurrency(order.grandTotal)}</strong> for this order. After you pay,
                upload a screenshot of the payment confirmation below — our team will verify it and
                mark your order as paid.
              </p>
              {qrImage ? (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <img
                    src={qrImage}
                    alt="Payment QR code"
                    className="size-56 rounded-lg border border-sky-200 bg-white object-contain p-2"
                  />
                  <p className="text-xs text-sky-700">
                    Order ref: <span className="font-mono font-semibold">{order.orderNumber}</span>
                  </p>
                  <a
                    href={qrImage}
                    download="payment-qr-code.png"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-sky-700 px-3 text-xs font-medium text-white transition-colors hover:bg-sky-800"
                  >
                    <Download className="size-4" /> Download QR Code
                  </a>
                </div>
              ) : (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-white/60 p-2 text-xs text-sky-800">
                  <Info className="size-3.5 shrink-0 mt-0.5" />
                  <span>
                    QR code is not yet uploaded by the store. Our team will reach out with payment
                    instructions shortly. You can also pay cash on delivery.
                  </span>
                </div>
              )}
              <div className="mt-3 flex items-center gap-1.5 rounded-md bg-white/60 p-2 text-[11px] text-sky-800">
                <Info className="size-3 shrink-0" />
                <span>
                  Payment status: <strong className="capitalize">{order.paymentStatus}</strong>.
                  Once we confirm your UPI transfer, the status will change to{" "}
                  <strong>paid</strong>.
                </span>
              </div>

              {/* Upload payment screenshot */}
              {screenshotUploaded ? (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <Check className="size-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-semibold">Payment screenshot uploaded</p>
                    <p className="text-emerald-700">
                      Uploaded{order.paymentScreenshotUploadedAt ? ` on ${formatDateTime(order.paymentScreenshotUploadedAt)}` : ""}.
                      Awaiting verification from our team.
                      {order.paymentTxnId && (
                        <>
                          {" "}Your transaction ID:{" "}
                          <span className="font-mono font-semibold">{order.paymentTxnId}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <PaymentScreenshotUploader
                  orderId={order.id}
                  onUploaded={() => {
                    qc.invalidateQueries({ queryKey: ["customer", "order-success", orderId] });
                    qc.invalidateQueries({ queryKey: ["customer", "track", orderId] });
                  }}
                />
              )}
            </motion.div>
          )}

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <p className="font-medium">What happens next?</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Our pharmacist will review your order.</li>
              <li>You&apos;ll get an update when it&apos;s packed.</li>
              <li>Out for delivery — you&apos;ll receive a call.</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => navigate({ name: "track-order", orderId: order.id })}
              className="flex-1 gap-2"
            >
              Track order <ArrowRight className="size-4" />
            </Button>
            <Button
              onClick={() => navigate({ name: "shop" })}
              variant="outline"
              className="flex-1 gap-2"
            >
              <ShoppingBag className="size-4" /> Continue shopping
            </Button>
          </div>
          <Button
            onClick={() => navigate({ name: "home" })}
            variant="ghost"
            size="sm"
            className="w-full gap-2"
          >
            <Home className="size-4" /> Back to home
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

/** Inline uploader for the payment screenshot. Posts multipart/form-data to
 *  /api/orders/[id]/payment-screenshot, then calls onUploaded so the parent
 *  can refetch the order and swap to the "screenshot uploaded" state. */
function PaymentScreenshotUploader({
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
    <div className="mt-4 rounded-md border border-sky-200 bg-white/70 p-3">
      <div className="flex items-center gap-2 text-sky-900">
        <Upload className="size-4" />
        <h4 className="text-xs font-semibold">Upload Payment Screenshot</h4>
      </div>
      <p className="mt-1 text-[11px] text-sky-800">
        Upload a clear screenshot of your UPI payment confirmation so we can verify your payment
        faster. PNG / JPG / WEBP up to 8 MB.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="ps-file" className="text-[11px] text-sky-900">Screenshot *</Label>
          <Input
            id="ps-file"
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
          <Label htmlFor="ps-txn" className="text-[11px] text-sky-900">Transaction ID (optional)</Label>
          <Input
            id="ps-txn"
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
