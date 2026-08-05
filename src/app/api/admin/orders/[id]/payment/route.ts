// ============================================================================
// File: src/app/api/admin/orders/[id]/payment/route.ts
// Purpose: Update payment status (7 statuses) with auto-trigger:
//          timeline, customer email, Apps Notification's.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { sendOrderNotification } from "@/lib/notifications";
import { sendAutoNotification } from "@/lib/app-notifs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_PAYMENT_STATUSES = new Set([
  "pending",
  "paid",
  "partially_paid",
  "failed",
  "refunded",
  "refund_initiated",
  "cancelled",
]);

const PAYMENT_EMAIL_TEMPLATES: Record<string, string> = {
  paid: "payment_successful",
  failed: "payment_failed",
  refunded: "refund_completed",
  refund_initiated: "refund_initiated",
};

const PAYMENT_APP_NOTIF_TEMPLATES: Record<string, string> = {
  paid: "payment_successful",
  failed: "payment_failed",
  refunded: "refund_completed",
  refund_initiated: "refund_initiated",
};

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

  if (!body?.paymentStatus || !ALLOWED_PAYMENT_STATUSES.has(body.paymentStatus)) {
    return err(`Invalid payment status. Allowed: ${Array.from(ALLOWED_PAYMENT_STATUSES).join(", ")}`, 400);
  }

  const order = await db.order.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!order) return notFound("Order not found");

  if (order.paymentStatus === body.paymentStatus) {
    return err(`Payment status is already "${body.paymentStatus}"`, 400);
  }

  const update: any = { paymentStatus: body.paymentStatus };
  if (body.paymentId !== undefined) update.paymentId = body.paymentId || null;
  if (body.paymentGateway !== undefined) update.paymentGateway = body.paymentGateway || null;

  const updated = await db.order.update({
    where: { id },
    data: update,
    include: {
      items: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  // 1. Timeline entry
  await db.orderStatusHistory.create({
    data: {
      orderId: id,
      status: order.status,
      note: body.note?.trim() || `Payment status: ${order.paymentStatus} → ${body.paymentStatus}${body.paymentId ? ` (txn ${body.paymentId})` : ""}`,
      createdBy: admin.id,
    },
  });

  // 2. Auto-trigger email + Apps Notification's
  const vars: Record<string, string | number> = {
    name: order.customer?.name || "Customer",
    orderNumber: order.orderNumber,
    orderAmount: order.grandTotal.toFixed(2),
  };

  const emailTemplateKey = PAYMENT_EMAIL_TEMPLATES[body.paymentStatus];
  const appNotifTemplateKey = PAYMENT_APP_NOTIF_TEMPLATES[body.paymentStatus];

  if (emailTemplateKey && order.customer?.email) {
    sendOrderNotification(order.customer, emailTemplateKey, vars).catch((e) =>
      console.error(`[payment] email failed:`, e?.message)
    );
  }

  if (appNotifTemplateKey && order.customer?.id) {
    sendAutoNotification(
      order.customer.id,
      appNotifTemplateKey,
      { ...vars, customerName: order.customer.name, storeName: "Pradeep Medical Store" },
      { orderId: id, paymentStatus: body.paymentStatus }
    ).catch((e) => console.error(`[payment] app notif failed:`, e?.message));
  }

  return ok(updated);
}
