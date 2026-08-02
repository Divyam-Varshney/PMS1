// ============================================================================
// File: src/app/api/customer/stats/route.ts
// Purpose: Aggregated customer statistics for the account dashboard.
//          Returns total savings, order count, loyalty points, avg order
//          value, and items purchased — all computed from delivered/confirmed
//          orders. Powers the "Savings Tracker" card on the account page.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  // Run all 3 queries in parallel (previously sequential — saved ~1s with Supabase)
  const [agg, itemsAgg, cust] = await Promise.all([
    db.order.aggregate({
      where: { customerId: customer.id, status: { not: "cancelled" } },
      _sum: {
        productDiscount: true, voucherDiscount: true, loyaltyDiscount: true,
        grandTotal: true, itemsTotal: true,
      },
      _count: true,
    }),
    db.orderItem.aggregate({
      where: { order: { customerId: customer.id, status: { not: "cancelled" } } },
      _sum: { qty: true },
      _count: true,
    }),
    db.customer.findUnique({
      where: { id: customer.id },
      select: { loyaltyPoints: true },
    }),
  ]);

  const totalSavings =
    Number(agg._sum.productDiscount ?? 0) +
    Number(agg._sum.voucherDiscount ?? 0) +
    Number(agg._sum.loyaltyDiscount ?? 0);
  const totalSpent = Number(agg._sum.grandTotal ?? 0);
  const totalOrders = agg._count;
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
  const totalItemsPurchased = itemsAgg._sum.qty ?? 0;

  return ok({
    totalSavings,
    totalSpent,
    totalOrders,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    totalItemsPurchased,
    loyaltyPoints: cust?.loyaltyPoints ?? 0,
    loyaltyPointsValue: cust?.loyaltyPoints ?? 0,
  });
}
