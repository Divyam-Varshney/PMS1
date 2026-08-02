// ============================================================================
// File: src/app/api/admin/orders/[id]/payment/route.ts
// Purpose: Update an order's payment status (pending | paid | failed | refunded)
//          and optionally record a payment gateway transaction id. Records a
//          row in OrderStatusHistory so the change is auditable.
// Role: Powers the "Payment Status" select on the admin OrderDetailView.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["pending", "paid", "failed", "refunded"]);

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{
    paymentStatus?: string;
    paymentId?: string;
    paymentGateway?: string;
    note?: string;
  }>(req);
  if (!body?.paymentStatus || !ALLOWED.has(body.paymentStatus)) {
    return err("Invalid payment status. Allowed: pending, paid, failed, refunded", 400);
  }

  const order = await db.order.findUnique({ where: { id } });
  if (!order) return notFound("Order not found");

  const update: any = { paymentStatus: body.paymentStatus };
  if (body.paymentId !== undefined) update.paymentId = body.paymentId || null;
  if (body.paymentGateway !== undefined)
    update.paymentGateway = body.paymentGateway || null;

  const updated = await db.order.update({
    where: { id },
    data: update,
    include: {
      items: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  // Audit trail entry
  await db.orderStatusHistory.create({
    data: {
      orderId: id,
      status: order.status, // keep the fulfillment status unchanged
      note:
        body.note?.trim() ||
        `Payment status updated to "${body.paymentStatus}"${body.paymentId ? ` (txn ${body.paymentId})` : ""}`,
      createdBy: admin.id,
    },
  });

  // NOTE: Payment updates do NOT create admin bell notifications.
  // The bell only notifies on: new orders, new prescriptions, new manual requests.

  return ok(updated);
}
