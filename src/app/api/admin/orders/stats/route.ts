// ============================================================================
// File: src/app/api/admin/orders/stats/route.ts
// Purpose: Comprehensive order stats with 14 metrics, trends, and caching.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

let _cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 30 * 1000;

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
    return ok(_cache.data);
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const [
    grouped, todayCount, todayRevenueRows, yesterdayRevenueRows,
    totalRevenueRows, totalPaidCount, refundedCount, rxCount, mrCount,
  ] = await Promise.all([
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.count({ where: { createdAt: { gte: startOfToday } } }),
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("grandTotal"), 0)::numeric AS total FROM "Order" WHERE "paymentStatus" = 'paid' AND "createdAt" >= ${startOfToday}`,
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("grandTotal"), 0)::numeric AS total FROM "Order" WHERE "paymentStatus" = 'paid' AND "createdAt" >= ${startOfYesterday} AND "createdAt" < ${startOfToday}`,
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("grandTotal"), 0)::numeric AS total FROM "Order" WHERE "paymentStatus" = 'paid' AND status NOT IN ('cancelled', 'returned')`,
    db.order.count({ where: { paymentStatus: "paid", status: { notIn: ["cancelled", "returned"] } } }),
    db.order.count({ where: { paymentStatus: "refunded" } }),
    db.order.count({ where: { OR: [{ source: "prescription" }, { prescriptionId: { not: null } }] } }),
    db.order.count({ where: { source: "manual_request" } }),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    total += row._count._all;
  }

  const todayRevenue = Number(todayRevenueRows[0]?.total ?? 0);
  const yesterdayRevenue = Number(yesterdayRevenueRows[0]?.total ?? 0);
  const totalRevenue = Number(totalRevenueRows[0]?.total ?? 0);
  const averageOrderValue = totalPaidCount > 0 ? totalRevenue / totalPaidCount : 0;
  const revenueTrend = yesterdayRevenue > 0
    ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
    : todayRevenue > 0 ? 100 : 0;

  const data = {
    total,
    today: todayCount,
    pending: counts["pending"] ?? 0,
    confirmed: counts["confirmed"] ?? 0,
    packed: counts["packed"] ?? 0,
    out_for_delivery: counts["out_for_delivery"] ?? 0,
    delivered: counts["delivered"] ?? 0,
    cancelled: counts["cancelled"] ?? 0,
    returned: counts["returned"] ?? 0,
    refunded: refundedCount,
    prescriptionOrders: rxCount,
    medicineRequests: mrCount,
    todayRevenue,
    yesterdayRevenue,
    totalRevenue,
    averageOrderValue,
    revenueTrend,
  };

  _cache = { data, ts: Date.now() };
  return ok(data);
}
