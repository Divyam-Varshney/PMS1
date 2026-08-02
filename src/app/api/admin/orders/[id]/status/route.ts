// ============================================================================
// File: src/app/api/admin/orders/[id]/status/route.ts
// Purpose: Update an order's status. Records OrderStatusHistory, sets the
//          matching timestamp (confirmedAt, packedAt, etc.), and dispatches
//          the corresponding notification template to the customer.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { sendOrderNotification } from "@/lib/notifications";
import { sendAutoNotification } from "@/lib/app-notifs";
import { awardOrderPoints, clawbackOrderPoints } from "@/lib/loyalty";

type Ctx = { params: Promise<{ id: string }> };

const STATUS_TIMESTAMPS: Record<string, string> = {
  confirmed: "confirmedAt",
  packed: "packedAt",
  out_for_delivery: "outForDeliveryAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
};

const ALLOWED = new Set([
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
]);

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ status?: string; note?: string; reason?: string }>(req);
  if (!body?.status || !ALLOWED.has(body.status)) {
    return err("Invalid status", 400);
  }

  const order = await db.order.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!order) return notFound("Order not found");

  // ── Smart status workflow — prevent invalid transitions ──
  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["packed", "out_for_delivery", "delivered", "cancelled"],
    packed: ["out_for_delivery", "delivered", "cancelled"],
    out_for_delivery: ["delivered", "cancelled"],
    delivered: ["returned"],
    returned: [],
    cancelled: [],
  };

  const allowedNext = VALID_TRANSITIONS[order.status] ?? [];
  if (order.status === body.status) {
    return err(`Order is already ${body.status}`, 400);
  }
  if (allowedNext.length === 0) {
    return err(`Cannot change status of a ${order.status} order (terminal state)`, 400);
  }
  if (!allowedNext.includes(body.status)) {
    return err(`Invalid transition: ${order.status} → ${body.status}. Allowed: ${allowedNext.join(", ")}`, 400);
  }

  const note = body.note?.trim() || undefined;
  const update: any = { status: body.status };
  const tsField = STATUS_TIMESTAMPS[body.status];
  if (tsField) update[tsField] = new Date();

  const updated = await db.order.update({
    where: { id },
    data: update,
    include: {
      customer: true,
      items: { include: { product: { select: { id: true, name: true } } } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  await db.orderStatusHistory.create({
    data: {
      orderId: id,
      status: body.status,
      note: note ?? (body.status === "cancelled" && body.reason ? body.reason : null),
      createdBy: admin.id,
    },
  });

  // Send matching notification (skip pending — no template)
  const TEMPLATE_MAP: Record<string, string> = {
    confirmed: "order_confirmed",
    packed: "order_packed",
    out_for_delivery: "order_out_for_delivery",
    delivered: "order_delivered",
    cancelled: "order_cancelled",
  };
  const tplKey = TEMPLATE_MAP[body.status];
  if (tplKey && order.customer) {
    // Get the human-readable payment method label (not the raw "qr" key)
    let paymentMethodLabel = order.paymentMethod;
    try {
      const pm = await db.paymentMethod.findUnique({ where: { key: order.paymentMethod } });
      if (pm?.label) paymentMethodLabel = pm.label;
    } catch {}
    const vars: Record<string, string | number> = {
      name: order.customer.name,
      orderNumber: order.orderNumber,
      amount: order.grandTotal.toFixed(2),
      paymentMethod: paymentMethodLabel,
    };
    if (body.status === "cancelled") vars.reason = body.reason || note || "N/A";
    await sendOrderNotification(order.customer, tplKey, vars).catch(() => {});

    // App (Web Push) notification — uses the matching app-notif template key.
    // Note: app-notif templates use "out_for_delivery" (without the "order_"
    // prefix) to match the email key; we map the status directly.
    const APP_NOTIF_STATUS_MAP: Record<string, string> = {
      confirmed: "order_confirmed",
      packed: "order_packed",
      out_for_delivery: "out_for_delivery",
      delivered: "order_delivered",
      cancelled: "order_cancelled",
    };
    const appTplKey = APP_NOTIF_STATUS_MAP[body.status];
    if (appTplKey) {
      await sendAutoNotification(
        order.customer.id,
        appTplKey,
        vars,
        { orderId: id, orderNumber: order.orderNumber, status: body.status }
      ).catch((e) => console.error("[order-status] sendAutoNotification failed:", e));
    }
  }

  // Loyalty points — award on delivery, claw back on cancel/return.
  // Wrapped in try/catch so loyalty failures never break status updates.
  try {
    if (body.status === "delivered") {
      await awardOrderPoints(id);
    } else if (body.status === "cancelled" || body.status === "returned") {
      await clawbackOrderPoints(id);
    }
  } catch (e) {
    console.error("[loyalty] status-change hook failed:", e);
  }

  // Prescription refill reminder auto-creation — when an order containing
  // prescriptionRequired products is delivered, create (or refresh) a
  // RefillReminder for each unique Rx product so the customer is prompted
  // to reorder around when their pack runs out. Wrapped in try/catch so
  // reminder failures never break status updates.
  try {
    if (body.status === "delivered" && order.customerId) {
      const rxItems = updated.items.filter(
        (it) => it.product?.id && it.product.id !== null
      );
      // Re-query the products to check prescriptionRequired (the items
      // relation above only selects id + name to keep the status response
      // light).
      const productIds = Array.from(
        new Set(rxItems.map((it) => it.product!.id))
      );
      if (productIds.length > 0) {
        const rxProducts = await db.product.findMany({
          where: { id: { in: productIds }, prescriptionRequired: true },
          select: { id: true },
        });
        const now = new Date();
        for (const p of rxProducts) {
          const daysSupply = 30; // default estimated days per pack
          const nextRefillDate = new Date(now);
          nextRefillDate.setDate(nextRefillDate.getDate() + daysSupply);
          // De-dupe: refresh existing active reminder for this customer+product
          const existing = await db.refillReminder.findFirst({
            where: { customerId: order.customerId, productId: p.id, isActive: true },
          });
          if (existing) {
            await db.refillReminder.update({
              where: { id: existing.id },
              data: { orderId: id, lastOrdered: now, nextRefillDate, daysSupply, notifiedAt: null },
            });
          } else {
            await db.refillReminder.create({
              data: {
                customerId: order.customerId,
                productId: p.id,
                orderId: id,
                lastOrdered: now,
                nextRefillDate,
                daysSupply,
                isActive: true,
              },
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[refill-reminders] status-change hook failed:", e);
  }

  // NOTE: Order status updates do NOT create admin bell notifications.
  // The bell only notifies on: new orders, new prescriptions, new manual requests.
  // The customer still gets their email notification (sendOrderNotification above).

  return ok(updated);
}
