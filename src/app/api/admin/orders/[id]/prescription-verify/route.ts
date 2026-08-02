// ============================================================================
// File: src/app/api/admin/orders/[id]/prescription-verify/route.ts
// Purpose: Approve or reject the prescription attached to an order.
//            POST { action: "approve" | "reject", reason?: string }
//
//          On APPROVE:
//            - marks the linked Prescription.status = "verified"
//            - adds an OrderStatusHistory entry "Prescription approved"
//            - sends the customer the prescription_approved email
//
//          On REJECT:
//            - marks the linked Prescription.status = "rejected"
//            - cancels the order (sets status="cancelled", cancelledAt=now)
//              with a note explaining the rejection reason
//            - records both an OrderStatusHistory entry AND a notification
//              to the customer via the existing order_cancelled template
//            - sends the customer the prescription_rejected email
//
//          All email/notification failures are wrapped in try/catch — they
//          must NEVER block the verification action.
// Role: Powers the Approve / Reject buttons in the admin OrderDetailView's
//       Prescription tab.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { sendNotification } from "@/lib/notifications";
import { createAdminNotification } from "@/lib/admin-notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ action?: string; reason?: string }>(req);
  if (!body?.action || !["approve", "reject"].includes(body.action)) {
    return err("Invalid action. Allowed: approve, reject", 400);
  }

  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!order) return notFound("Order not found");

  if (!order.prescriptionId) {
    return err("This order has no linked prescription", 400);
  }

  const prescription = await db.prescription.findUnique({
    where: { id: order.prescriptionId },
    include: { customer: { select: { id: true, name: true, email: true } } },
  });
  if (!prescription) return notFound("Prescription not found");

  const reason = body.reason?.trim();
  const refId = prescription.id.slice(-8).toUpperCase();

  if (body.action === "approve") {
    // 1. Update prescription status
    await db.prescription.update({
      where: { id: prescription.id },
      data: { status: "verified" },
    });

    // 2. Audit trail entry on the order
    await db.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: "Prescription approved",
        createdBy: admin.id,
      },
    });

    // 3. Customer email
    if (prescription.customer?.email) {
      try {
        await sendNotification({
          to: prescription.customer.email,
          templateKey: "prescription_approved",
          vars: { name: prescription.customer.name, refId },
          customerId: prescription.customer.id,
          channel: "email",
        });
      } catch (e) {
        console.error("[prescription-verify] approve email failed:", e);
      }
    }

    return ok({ action: "approve", prescriptionStatus: "verified" });
  }

  // REJECT path ---------------------------------------------------------------
  if (!reason) {
    return err("A reason is required when rejecting a prescription", 400);
  }

  // 1. Update prescription status + admin notes
  await db.prescription.update({
    where: { id: prescription.id },
    data: {
      status: "rejected",
      adminNotes: reason,
    },
  });

  // 2. Cancel the order (the prescription cannot be fulfilled). Skip if
  //    the order is already cancelled or delivered/returned — those are
  //    terminal states where we just record the audit entry instead.
  const now = new Date();
  if (order.status !== "cancelled" && order.status !== "delivered" && order.status !== "returned") {
    await db.order.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: now,
      },
    });

    await db.orderStatusHistory.create({
      data: {
        orderId: id,
        status: "cancelled",
        note: `Prescription rejected: ${reason}`,
        createdBy: admin.id,
      },
    });
  } else {
    await db.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: `Prescription rejected: ${reason}`,
        createdBy: admin.id,
      },
    });
  }

  // 3. Notify the customer (email)
  if (prescription.customer?.email) {
    try {
      await sendNotification({
        to: prescription.customer.email,
        templateKey: "prescription_rejected",
        vars: { name: prescription.customer.name, refId, reason },
        customerId: prescription.customer.id,
        channel: "email",
      });
    } catch (e) {
      console.error("[prescription-verify] reject email failed:", e);
    }
  }

  // 4. Bell + email notification for the admin team (so the rejection is
  //    visible in the notification log even if SMTP is down).
  try {
    await createAdminNotification({
      type: "system_alert",
      title: `Prescription rejected — ${order.orderNumber}`,
      message: `Prescription for order ${order.orderNumber} was rejected by ${admin.name}. Reason: ${reason}`,
      refId: order.id,
      refType: "order",
      customerName: order.customer?.name ?? order.shipName,
      emailDetails: `Order: ${order.orderNumber}\nReason: ${reason}`,
    });
  } catch (e) {
    console.error("[prescription-verify] admin notification failed:", e);
  }

  return ok({ action: "reject", prescriptionStatus: "rejected", orderStatus: "cancelled" });
}
