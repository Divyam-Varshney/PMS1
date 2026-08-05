// ============================================================================
// File: src/app/api/admin/counts/route.ts
// Purpose: Lightweight endpoint that returns badge counts for the admin
//          sidebar — pending orders, low stock items, pending prescriptions,
//          pending manual requests. Designed to be fast (simple COUNT queries)
//          so it can be polled by the sidebar without impacting performance.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const [
    pendingOrders,
    lowStock,
    pendingPrescriptions,
    pendingManualRequests,
    unreadNotifications,
  ] = await Promise.all([
    db.order.count({ where: { status: "pending" } }),
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "Product"
      WHERE stock <= "lowStockThreshold" AND status = 'active'
    `,
    db.prescription.count({ where: { status: "pending" } }),
    db.manualRequest.count({ where: { status: "pending" } }),
    db.adminNotification.count({ where: { isRead: false } }),
  ]);

  return ok({
    pendingOrders,
    lowStock: Number(lowStock[0]?.count ?? 0),
    pendingPrescriptions,
    pendingManualRequests,
    unreadNotifications,
  });
}
