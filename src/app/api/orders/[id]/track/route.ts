// ============================================================================
// File: src/app/api/orders/[id]/track/route.ts
// Purpose: Return an order with its full status-history timeline for the
//          TrackOrderView. Must belong to the current customer (or 403).
//          When the order's paymentMethod is "qr", also returns the public
//          QR image URL (from PaymentMethod.config.qrImage) so the order
//          success / track pages can render the QR code for the customer.
// Role: Powers the TrackOrderView timeline + order summary + QR display.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return notFound("Order not found");
  if (order.customerId !== customer.id) return forbidden();

  // For QR payment orders, fetch the QR image URL (public, no secrets) so the
  // order-success view can show the QR code to the customer.
  let paymentQrImage: string | null = null;
  if (order.paymentMethod === "qr") {
    const pm = await db.paymentMethod.findUnique({
      where: { key: "qr" },
      select: { config: true },
    });
    if (pm?.config) {
      try {
        const cfg = JSON.parse(pm.config) as { qrImage?: string };
        paymentQrImage = cfg.qrImage ?? null;
      } catch {
        paymentQrImage = null;
      }
    }
  }

  return ok({
    ...order,
    paymentQrImage,
    paymentScreenshot: order.paymentScreenshot,
    paymentScreenshotUploadedAt: order.paymentScreenshotUploadedAt,
    paymentTxnId: order.paymentTxnId,
  });
}
