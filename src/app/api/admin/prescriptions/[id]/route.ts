// ============================================================================
// File: src/app/api/admin/prescriptions/[id]/route.ts
// Purpose: Get / update a prescription.
//          PATCH supports changing `status`, `adminNotes`, and `convertedOrderId`.
//          Status transitions fire customer emails:
//            pending      -> under_review : prescription_under_review
//            *            -> verified     : prescription_approved
//            *            -> rejected     : prescription_rejected
//            *            -> converted    : prescription_completed
//          Each send is wrapped in try/catch — email failures never block the
//          status update (the NotificationLog still records the attempt).
// Role: Powers the admin PrescriptionsView detail panel + status actions.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { sendNotification } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const p = await db.prescription.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!p) return notFound();

  let images: string[] = [];
  try {
    images = JSON.parse(p.images);
  } catch (e) { console.error("[rx] error:", e); }
  return ok({ ...p, images });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ status?: string; adminNotes?: string; convertedOrderId?: string }>(req);
  if (!body) return err("Invalid body", 400);

  const existing = await db.prescription.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, email: true } } },
  });
  if (!existing) return notFound();

  const newStatus = body.status ?? existing.status;
  const newAdminNotes =
    body.adminNotes !== undefined ? body.adminNotes || null : existing.adminNotes;

  const updated = await db.prescription.update({
    where: { id },
    data: {
      status: newStatus,
      adminNotes: newAdminNotes,
      convertedOrderId:
        body.convertedOrderId !== undefined
          ? body.convertedOrderId || null
          : existing.convertedOrderId,
    },
    include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
  });

  // If converting to an order, link back to the prescription
  if (body.status === "converted" && body.convertedOrderId) {
    await db.order.update({
      where: { id: body.convertedOrderId },
      data: { prescriptionId: id, source: "prescription" },
    });
  }

  // ---------------------------------------------------------------------------
  // Customer email on status change.
  //   - under_review : prescription_under_review (pharmacist started reviewing)
  //   - verified     : prescription_approved    (approved, ready for checkout)
  //   - rejected     : prescription_rejected    (rejected, reason in adminNotes)
  //   - converted    : prescription_completed   (order created from prescription)
  //
  // Only fires when the status actually transitions (not on every save), so
  // the customer doesn't get spammed if the admin edits notes while the status
  // stays the same.
  // ---------------------------------------------------------------------------
  const statusChanged = newStatus !== existing.status;
  if (statusChanged && existing.customer && existing.customer.email) {
    const refId = id.slice(-8).toUpperCase();
    const cust = existing.customer;
    try {
      if (newStatus === "under_review") {
        await sendNotification({
          to: cust.email,
          templateKey: "prescription_under_review",
          vars: { name: cust.name, refId },
          customerId: cust.id,
          channel: "email",
        });
      } else if (newStatus === "verified") {
        await sendNotification({
          to: cust.email,
          templateKey: "prescription_approved",
          vars: { name: cust.name, refId },
          customerId: cust.id,
          channel: "email",
        });
      } else if (newStatus === "rejected") {
        const reason = newAdminNotes || "N/A";
        await sendNotification({
          to: cust.email,
          templateKey: "prescription_rejected",
          vars: { name: cust.name, refId, reason },
          customerId: cust.id,
          channel: "email",
        });
      } else if (newStatus === "converted") {
        await sendNotification({
          to: cust.email,
          templateKey: "prescription_completed",
          vars: { name: cust.name, refId },
          customerId: cust.id,
          channel: "email",
        });
      }
    } catch (e) {
      // Email failures must never block the prescription status update.
      console.error("[rx] notification send failed:", e);
    }
  }

  return ok(updated);
}
