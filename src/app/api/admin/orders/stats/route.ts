// ============================================================================
// File: src/app/api/admin/orders/stats/route.ts
// Purpose: Quick-stats summary for the Orders list header. Returns counts by
//          status (total, pending, confirmed, packed, out_for_delivery,
//          delivered, cancelled, returned) plus today's revenue (sum of
//          grandTotal for paid orders created today).
// Role: Powers the Quick Stats bar at the top of the admin OrdersView.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";
import { Prisma } from "@prisma/client";

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  // Group by status → single round-trip.
  const grouped = await db.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    total += row._count._all;
  }

  // Today's revenue — sum of grandTotal for PAID orders created today.
  // Use a raw SQL aggregate so Decimal sums stay accurate; results come
  // back as a single Decimal that Prisma serializes to number via api.ok.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const revenueRows = await db.$queryRaw<{ total: Prisma.Decimal | null }[]>`
    SELECT COALESCE(SUM("grandTotal"), 0)::numeric AS total
    FROM "Order"
    WHERE "paymentStatus" = 'paid'
      AND "createdAt" >= ${startOfToday}
  `;
  const todayRevenue = Number(revenueRows[0]?.total ?? 0);

  // Yesterday's revenue — gives the admin a quick comparison.
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const yesterdayRows = await db.$queryRaw<{ total: Prisma.Decimal | null }[]>`
    SELECT COALESCE(SUM("grandTotal"), 0)::numeric AS total
    FROM "Order"
    WHERE "paymentStatus" = 'paid'
      AND "createdAt" >= ${startOfYesterday}
      AND "createdAt" <  ${startOfToday}
  `;
  const yesterdayRevenue = Number(yesterdayRows[0]?.total ?? 0);

  return ok({
    total,
    pending: counts["pending"] ?? 0,
    confirmed: counts["confirmed"] ?? 0,
    packed: counts["packed"] ?? 0,
    out_for_delivery: counts["out_for_delivery"] ?? 0,
    shipped: (counts["packed"] ?? 0) + (counts["out_for_delivery"] ?? 0),
    delivered: counts["delivered"] ?? 0,
    cancelled: counts["cancelled"] ?? 0,
    returned: counts["returned"] ?? 0,
    todayRevenue,
    yesterdayRevenue,
  });
}
