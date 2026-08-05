// ============================================================================
// File: src/app/api/admin/manual-requests/[id]/route.ts
// Purpose: Get / update a manual medicine request.
//          PATCH supports changing `status`, `adminNotes`, and `convertedOrderId`.
//          Status transitions fire customer emails:
//            pending      -> under_review : manual_request_under_review
//            *            -> verified     : manual_request_approved
//            *            -> rejected     : manual_request_rejected
//            *            -> converted    : manual_request_completed
//          Each send is wrapped in try/catch — email failures never block the
//          status update (the NotificationLog still records the attempt).
// Role: Powers the admin ManualRequestsView detail panel + status actions.
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
  const r = await db.manualRequest.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!r) return notFound();
  return ok({
    ...r,
    medicines: r.medicineList.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await parseBody<{ status?: string; adminNotes?: string; convertedOrderId?: string }>(req);
  if (!body) return err("Invalid body", 400);

  const existing = await db.manualRequest.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, email: true } } },
  });
  if (!existing) return notFound();

  const newStatus = body.status ?? existing.status;
  const newAdminNotes =
    body.adminNotes !== undefined ? body.adminNotes || null : existing.adminNotes;

  const updated = await db.manualRequest.update({
    where: { id },
    data: {
      status: newStatus,
      adminNotes: newAdminNotes,
      convertedOrderId:
        body.convertedOrderId !== undefined ? body.convertedOrderId || null : existing.convertedOrderId,
    },
    include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
  });

  if (body.status === "converted" && body.convertedOrderId) {
    await db.order.update({
      where: { id: body.convertedOrderId },
      data: { manualRequestId: id, source: "manual_request" },
    });
  }

  // ---------------------------------------------------------------------------
  // Customer email on status change. Mirrors the prescription flow.
  //   - under_review : manual_request_under_review
  //   - verified     : manual_request_approved
  //   - rejected     : manual_request_rejected (reason in adminNotes)
  //   - converted    : manual_request_completed (order created)
  //
  // Only fires on actual transitions.
  // ---------------------------------------------------------------------------
  const statusChanged = newStatus !== existing.status;
  if (statusChanged && existing.customer && existing.customer.email) {
    const refId = id.slice(-8).toUpperCase();
    const cust = existing.customer;
    try {
      if (newStatus === "under_review") {
        await sendNotification({
          to: cust.email,
          templateKey: "manual_request_under_review",
          vars: { name: cust.name, refId },
          customerId: cust.id,
          channel: "email",
        });
      } else if (newStatus === "verified") {
        await sendNotification({
          to: cust.email,
          templateKey: "manual_request_approved",
          vars: { name: cust.name, refId },
          customerId: cust.id,
          channel: "email",
        });
      } else if (newStatus === "rejected") {
        const reason = newAdminNotes || "N/A";
        await sendNotification({
          to: cust.email,
          templateKey: "manual_request_rejected",
          vars: { name: cust.name, refId, reason },
          customerId: cust.id,
          channel: "email",
        });
      } else if (newStatus === "converted") {
        await sendNotification({
          to: cust.email,
          templateKey: "manual_request_completed",
          vars: { name: cust.name, refId },
          customerId: cust.id,
          channel: "email",
        });
      }
    } catch (e) {
      console.error("[mr] notification send failed:", e);
    }
  }

  return ok(updated);
}
