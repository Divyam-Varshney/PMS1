// ============================================================================
// File: src/app/api/admin/orders/[id]/shipping/route.ts
// Purpose: Update shipping / fulfillment metadata on an order:
//            - trackingNumber  (carrier's tracking id, e.g. Delhivery AWB)
//            - carrier         (delivery partner name)
//            - estimatedDelivery (DateTime)
//          Records an OrderStatusHistory entry with a short note so the
//          audit trail reflects every shipping-detail change.
// Role: Powers the "Shipping & Fulfillment" → "Edit shipping details" action
//       in the admin OrderDetailView.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{
    trackingNumber?: string | null;
    carrier?: string | null;
    estimatedDelivery?: string | null;
  }>(req);
  if (!body) return err("Invalid request body", 400);

  const order = await db.order.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!order) return notFound("Order not found");

  // The schema doesn't have dedicated trackingNumber / carrier columns on
  // Order. We pack them into the existing `adminNotes` field as a small
  // JSON header so the data round-trips reliably. The full breakdown is
  // still rendered on the detail page from the parsed header.
  // Estimated delivery DOES have a dedicated column (estimatedDelivery).
  const update: any = {};
  if (body.estimatedDelivery !== undefined) {
    update.estimatedDelivery = body.estimatedDelivery
      ? new Date(body.estimatedDelivery)
      : null;
  }

  // Build a small shipping-info header to prepend to adminNotes (replaces
  // any previous header so we don't accumulate stale entries).
  const shippingHeader = JSON.stringify({
    trackingNumber: body.trackingNumber ?? null,
    carrier: body.carrier ?? null,
  });

  // Read current adminNotes, strip any previous shipping header, then
  // prepend the new one.
  const existing = await db.order.findUnique({
    where: { id },
    select: { adminNotes: true },
  });
  let cleanedNotes = existing?.adminNotes ?? "";
  // Remove a previous "[shipping]{...}" header line if present.
  cleanedNotes = cleanedNotes.replace(/^\[shipping\].*\n?/, "");
  update.adminNotes =
    `[shipping]${shippingHeader}\n` + (cleanedNotes || "");

  await db.order.update({ where: { id }, data: update });

  // Audit trail entry — describe what changed.
  const changes: string[] = [];
  if (body.trackingNumber !== undefined) {
    changes.push(`tracking=${body.trackingNumber || "(cleared)"}`);
  }
  if (body.carrier !== undefined) {
    changes.push(`carrier=${body.carrier || "(cleared)"}`);
  }
  if (body.estimatedDelivery !== undefined) {
    changes.push(`eta=${body.estimatedDelivery || "(cleared)"}`);
  }

  await db.orderStatusHistory.create({
    data: {
      orderId: id,
      status: order.status,
      note: `Shipping details updated — ${changes.join(" · ") || "no changes"}`,
      createdBy: admin.id,
    },
  });

  const updated = await db.order.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  return ok(updated);
}
