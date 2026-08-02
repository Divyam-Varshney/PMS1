// ============================================================================
// File: src/app/api/admin/reports/sales/route.ts
// Purpose: Sales summary report for a date range.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, param } from "@/lib/api";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const fromStr = param(req, "from");
  const toStr = param(req, "to");
  const now = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  // BUG FIX: When "to" is a date string (e.g. "2026-07-06"), new Date() parses
  // it as midnight UTC, excluding all orders later that day. Set to end-of-day
  // (23:59:59.999 local) so today's orders are included.
  const toDate = toStr ? new Date(toStr) : new Date();
  toDate.setHours(23, 59, 59, 999);
  const to = toDate;

  const orders = await db.order.findMany({
    where: { createdAt: { gte: from, lte: to }, status: { not: "cancelled" } },
    select: {
      grandTotal: true,
      itemsTotal: true,
      productDiscount: true,
      voucherDiscount: true,
      loyaltyDiscount: true,
      deliveryCharge: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
    },
  });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.grandTotal), 0);
  const totalItems = orders.reduce((s, o) => s + Number(o.itemsTotal), 0);
  const totalDiscounts = orders.reduce((s, o) => s + Number(o.productDiscount) + Number(o.voucherDiscount) + Number(o.loyaltyDiscount || 0), 0);
  const totalDelivery = orders.reduce((s, o) => s + Number(o.deliveryCharge), 0);

  const byPaymentMethod: Record<string, { count: number; revenue: number }> = {};
  for (const o of orders) {
    if (!byPaymentMethod[o.paymentMethod]) byPaymentMethod[o.paymentMethod] = { count: 0, revenue: 0 };
    byPaymentMethod[o.paymentMethod].count += 1;
    byPaymentMethod[o.paymentMethod].revenue += Number(o.grandTotal);
  }

  // group by day for trend
  const dayMap = new Map<string, { date: string; revenue: number; orders: number }>();
  for (const o of orders) {
    const key = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!dayMap.has(key)) {
      dayMap.set(key, {
        date: new Date(key).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        revenue: 0,
        orders: 0,
      });
    }
    const b = dayMap.get(key)!;
    b.revenue += Number(o.grandTotal);
    b.orders += 1;
  }

  return ok({
    from,
    to,
    totalOrders,
    totalRevenue,
    totalItems,
    totalDiscounts,
    totalDelivery,
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    byPaymentMethod,
    trend: Array.from(dayMap.values()),
  });
}
