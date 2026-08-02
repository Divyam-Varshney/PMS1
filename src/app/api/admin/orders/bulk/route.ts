// ============================================================================
// File: src/app/api/admin/orders/bulk/route.ts
// Purpose: Bulk status update for orders. Admin-authenticated. Accepts a list
//          of order ids + a target status, updates all matching orders inside
//          a single transaction, and records an OrderStatusHistory entry for
//          each order (so the audit trail reflects the bulk action).
// Role: Supports the "Update Status" bulk action in the admin Orders view.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";

const ALLOWED_STATUSES = new Set([
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
]);

const STATUS_TIMESTAMPS: Record<string, string> = {
  confirmed: "confirmedAt",
  packed: "packedAt",
  out_for_delivery: "outForDeliveryAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
};

type Body = {
  ids: string[];
  action: "status";
  status: string;
  note?: string;
};

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<Body>(req);
  if (!body) return err("Invalid request body", 400);

  // Validate the action + status.
  if (body.action !== "status") {
    return err(`Unsupported action: ${body.action}`, 400);
  }
  if (!body.status || !ALLOWED_STATUSES.has(body.status)) {
    return err("Invalid status", 400);
  }

  // Validate the ids array.
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return err("ids array is required", 400);
  }

  const targetStatus = body.status as string;
  const tsField = STATUS_TIMESTAMPS[targetStatus];

  // Run the whole bulk update in a single transaction so partial failures
  // roll back. We only update orders that actually exist; non-existent ids are
  // silently skipped (counted as not-updated).
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.order.findMany({
      where: { id: { in: body.ids } },
      select: { id: true, status: true },
    });

    let updated = 0;
    const now = new Date();

    for (const order of existing) {
      // Skip terminal-state orders to match the single-status endpoint's rules:
      // delivered orders can only move to "returned", cancelled orders cannot
      // change status. This keeps bulk behaviour consistent with the single
      // PATCH endpoint and avoids corrupting the audit trail.
      if (order.status === "cancelled") continue;
      if (order.status === "delivered" && targetStatus !== "returned") continue;
      if (order.status === targetStatus) continue;

      const update: any = { status: targetStatus };
      if (tsField) update[tsField] = now;

      await tx.order.update({ where: { id: order.id }, data: update });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: targetStatus,
          note: body.note?.trim() || "Bulk status update",
          createdBy: admin.id,
        },
      });

      updated++;
    }

    return updated;
  });

  return ok({ updated: result });
}
