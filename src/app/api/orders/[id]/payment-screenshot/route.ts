// ============================================================================
// File: src/app/api/orders/[id]/payment-screenshot/route.ts
// Purpose: Customer-facing endpoint to upload a QR/UPI payment screenshot
//          for an order. Uses the cloud storage service (private bucket) so
//          uploads persist on Vercel's read-only filesystem. The screenshot
//          URL is stored on the Order along with the upload timestamp and an
//          optional customer-provided UPI transaction ID.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { storage, StorageError } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    select: { id: true, customerId: true, paymentMethod: true, status: true, paymentScreenshot: true },
  });
  if (!order) return notFound("Order not found");
  if (order.customerId !== customer.id) return forbidden();

  const form = await req.formData();
  const file = form.getAll("file").find((f): f is File => f instanceof File);
  if (!file) return err("No file uploaded", 400);

  // Optional transaction ID (customer-provided UPI reference number).
  const txnIdRaw = form.get("txnId");
  const txnId =
    typeof txnIdRaw === "string" ? txnIdRaw.trim().slice(0, 100) : null;

  try {
    // Delete the previous screenshot if re-uploading (avoid orphans).
    if (order.paymentScreenshot) {
      await storage.delete("payments", order.paymentScreenshot).catch(() => {});
    }

    const { url } = await storage.upload("payments", file, { ownerId: order.id });

    const updated = await db.order.update({
      where: { id },
      data: {
        paymentScreenshot: url,
        paymentScreenshotUploadedAt: new Date(),
        paymentTxnId: txnId || null,
      },
      select: {
        id: true,
        paymentScreenshot: true,
        paymentScreenshotUploadedAt: true,
        paymentTxnId: true,
      },
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof StorageError) return err(e.message, e.status);
    return err("Failed to upload screenshot", 500);
  }
}

// GET — returns the current screenshot metadata for this order (used by the
// track-order view to decide whether to show the upload form or the
// "screenshot uploaded" confirmation). Customer auth + ownership required.
export async function GET(_req: Request, { params }: Ctx) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentScreenshot: true,
      paymentScreenshotUploadedAt: true,
      paymentTxnId: true,
    },
  });
  if (!order) return notFound("Order not found");
  if (order.customerId !== customer.id) return forbidden();

  return ok({
    paymentScreenshot: order.paymentScreenshot,
    paymentScreenshotUploadedAt: order.paymentScreenshotUploadedAt,
    paymentTxnId: order.paymentTxnId,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
  });
}
