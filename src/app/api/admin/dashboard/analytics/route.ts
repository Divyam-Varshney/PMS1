// ============================================================================
// File: src/app/api/admin/dashboard/analytics/route.ts
// Purpose: Comprehensive BI analytics for the dashboard. Returns profit,
//          inventory, revenue, orders, customers, products, brands, categories,
//          coupons, prescriptions, delivery, and payment analytics in one call.
//          Cached for 60s to keep the dashboard fast.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

let _cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 60 * 1000;

export async function GET() {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return ok(_cache.data);

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(now); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(now); startOfMonth.setDate(1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    todayRev, yesterdayRev, weekRev, monthRev, yearRev,
    ordersByStatus, totalCustomers, newToday, returning, activeCustomers,
    totalProducts, activeProducts, draftProducts, outOfStock, lowStock, hiddenProducts, newProducts,
    rxPending, rxApproved, rxRejected, rxCompleted,
    mrPending, mrCompleted, mrUnavailable,
    paymentMethods, couponUsage, discountGiven,
    topProductsByQty, topProductsByRevenue, topBrands, topCategories,
    deliveredToday, cancelledDeliveries, lowStockProducts, profitData,
  ] = await Promise.all([
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("grandTotal"),0)::numeric AS total FROM "Order" WHERE "paymentStatus"='paid' AND "createdAt" >= ${startOfToday}`,
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("grandTotal"),0)::numeric AS total FROM "Order" WHERE "paymentStatus"='paid' AND "createdAt" >= ${startOfYesterday} AND "createdAt" < ${startOfToday}`,
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("grandTotal"),0)::numeric AS total FROM "Order" WHERE "paymentStatus"='paid' AND "createdAt" >= ${startOfWeek}`,
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("grandTotal"),0)::numeric AS total FROM "Order" WHERE "paymentStatus"='paid' AND "createdAt" >= ${startOfMonth}`,
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("grandTotal"),0)::numeric AS total FROM "Order" WHERE "paymentStatus"='paid' AND "createdAt" >= ${startOfYear}`,
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.customer.count(), db.customer.count({ where: { createdAt: { gte: startOfToday } } }),
    db.customer.count({ where: { orders: { some: { createdAt: { gte: startOfWeek } } } } }),
    db.customer.count({ where: { isActive: true } }),
    db.product.count(), db.product.count({ where: { status: "active" } }),
    db.product.count({ where: { status: "draft" } }),
    db.product.count({ where: { stock: 0, status: "active" } }),
    db.product.count({ where: { stock: { lte: 10, gt: 0 }, status: "active" } }),
    db.product.count({ where: { visibility: "hidden" } }),
    db.product.count({ where: { createdAt: { gte: startOfWeek } } }),
    db.prescription.count({ where: { status: "pending" } }),
    db.prescription.count({ where: { status: "verified" } }),
    db.prescription.count({ where: { status: "rejected" } }),
    db.prescription.count({ where: { status: "completed" } }),
    db.manualRequest.count({ where: { status: "pending" } }),
    db.manualRequest.count({ where: { status: "completed" } }),
    db.manualRequest.count({ where: { status: "unavailable" } }),
    db.order.groupBy({ by: ["paymentMethod"], _count: { _all: true }, where: { paymentStatus: "paid" } }),
    db.order.count({ where: { voucherCode: { not: null } } }),
    db.$queryRaw<{ total: Prisma.Decimal | null }[]>`SELECT COALESCE(SUM("voucherDiscount"),0)::numeric AS total FROM "Order" WHERE "voucherCode" IS NOT NULL`,
    db.orderItem.groupBy({ by: ["productId"], _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: 5, where: { product: { isNot: null } } }),
    db.$queryRaw<{ productId: string; total: Prisma.Decimal }[]>`SELECT "productId", SUM("qty" * "sellingPrice")::numeric AS total FROM "OrderItem" WHERE "productId" IS NOT NULL GROUP BY "productId" ORDER BY total DESC LIMIT 5`,
    db.$queryRaw<{ brandId: string; brandName: string; total: Prisma.Decimal }[]>`SELECT b.id AS "brandId", b.name AS "brandName", SUM(oi."qty" * oi."sellingPrice")::numeric AS total FROM "OrderItem" oi JOIN "Product" p ON oi."productId" = p.id JOIN "Brand" b ON p."brandId" = b.id GROUP BY b.id, b.name ORDER BY total DESC LIMIT 5`,
    db.$queryRaw<{ categoryId: string; categoryName: string; total: Prisma.Decimal }[]>`SELECT c.id AS "categoryId", c.name AS "categoryName", SUM(oi."qty" * oi."sellingPrice")::numeric AS total FROM "OrderItem" oi JOIN "Product" p ON oi."productId" = p.id JOIN "Category" c ON p."categoryId" = c.id GROUP BY c.id, c.name ORDER BY total DESC LIMIT 5`,
    db.order.count({ where: { status: "delivered", deliveredAt: { gte: startOfToday } } }),
    db.order.count({ where: { status: "cancelled", createdAt: { gte: startOfWeek } } }),
    db.product.findMany({ where: { stock: { lte: 10 }, status: "active" }, select: { id: true, name: true, stock: true, lowStockThreshold: true, sellingPrice: true, costPrice: true }, take: 10, orderBy: { stock: "asc" } }),
    db.$queryRaw<{ totalRevenue: Prisma.Decimal; totalCost: Prisma.Decimal; totalDiscount: Prisma.Decimal }[]>`SELECT COALESCE(SUM(oi."qty" * oi."sellingPrice"), 0)::numeric AS "totalRevenue", COALESCE(SUM(oi."qty" * COALESCE(p."costPrice", 0)), 0)::numeric AS "totalCost", COALESCE(SUM(o."voucherDiscount"), 0)::numeric AS "totalDiscount" FROM "OrderItem" oi LEFT JOIN "Product" p ON oi."productId" = p.id LEFT JOIN "Order" o ON oi."orderId" = o.id WHERE o."paymentStatus" = 'paid' AND o."status" NOT IN ('cancelled', 'returned')`,
  ]);

  const statusMap: Record<string, number> = {};
  let totalOrders = 0;
  for (const s of ordersByStatus) { statusMap[s.status] = s._count._all; totalOrders += s._count._all; }

  const todayRevenue = Number(todayRev[0]?.total ?? 0);
  const yesterdayRevenue = Number(yesterdayRev[0]?.total ?? 0);
  const totalRevenueNum = Number(profitData[0]?.totalRevenue ?? 0);
  const totalCostNum = Number(profitData[0]?.totalCost ?? 0);
  const totalDiscountNum = Number(profitData[0]?.totalDiscount ?? 0);
  const grossProfit = totalRevenueNum - totalCostNum;
  const netProfit = grossProfit - totalDiscountNum;
  const profitMargin = totalRevenueNum > 0 ? Math.round((netProfit / totalRevenueNum) * 100) : 0;
  const revenueTrend = yesterdayRevenue > 0 ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : todayRevenue > 0 ? 100 : 0;

  const topProductIds = topProductsByQty.map(p => p.productId).filter(Boolean);
  const productNames = topProductIds.length > 0 ? await db.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true, costPrice: true, sellingPrice: true } }) : [];
  const productNameMap = new Map(productNames.map(p => [p.id, p]));

  const topProducts = topProductsByQty.map(p => {
    const prod = productNameMap.get(p.productId);
    const revenue = Number(p._sum.qty || 0) * Number(prod?.sellingPrice || 0);
    const cost = Number(p._sum.qty || 0) * Number(prod?.costPrice || 0);
    return { id: p.productId, name: prod?.name || "Unknown", qty: p._sum.qty || 0, revenue, profit: revenue - cost };
  });

  const paymentDist = paymentMethods.map(pm => ({ method: pm.paymentMethod, count: pm._count._all, percentage: totalOrders > 0 ? Math.round((pm._count._all / totalOrders) * 100) : 0 }));
  const totalDelivered = statusMap["delivered"] ?? 0;
  const totalCancelled = statusMap["cancelled"] ?? 0;
  const deliverySuccessRate = (totalDelivered + totalCancelled) > 0 ? Math.round((totalDelivered / (totalDelivered + totalCancelled)) * 100) : 0;

  const data = {
    revenue: { today: todayRevenue, yesterday: yesterdayRevenue, week: Number(weekRev[0]?.total ?? 0), month: Number(monthRev[0]?.total ?? 0), year: Number(yearRev[0]?.total ?? 0), trend: revenueTrend },
    profit: { grossProfit, netProfit, profitMargin, avgProfitPerOrder: totalOrders > 0 ? netProfit / totalOrders : 0, totalRevenue: totalRevenueNum, totalCost: totalCostNum, totalDiscount: totalDiscountNum },
    orders: { total: totalOrders, pending: statusMap["pending"] ?? 0, confirmed: statusMap["confirmed"] ?? 0, packed: statusMap["packed"] ?? 0, out_for_delivery: statusMap["out_for_delivery"] ?? 0, delivered: totalDelivered, cancelled: totalCancelled, returned: statusMap["returned"] ?? 0 },
    customers: { total: totalCustomers, newToday, returning, active: activeCustomers, inactive: totalCustomers - activeCustomers },
    inventory: { total: totalProducts, active: activeProducts, draft: draftProducts, outOfStock, lowStock, hidden: hiddenProducts, newProducts, lowStockProducts: lowStockProducts.map(p => ({ id: p.id, name: p.name, stock: p.stock, threshold: p.lowStockThreshold, price: Number(p.sellingPrice) })) },
    topProducts, topRevenueProducts: topProductsByRevenue.map(p => { const prod = productNameMap.get(p.productId); return { id: p.productId, name: prod?.name || "Unknown", revenue: Number(p.total) }; }),
    topBrands: topBrands.map(b => ({ id: b.brandId, name: b.brandName, revenue: Number(b.total) })),
    topCategories: topCategories.map(c => ({ id: c.categoryId, name: c.categoryName, revenue: Number(c.total) })),
    coupons: { used: couponUsage, discountGiven: Number(discountGiven[0]?.total ?? 0) },
    prescriptions: { pending: rxPending, approved: rxApproved, rejected: rxRejected, completed: rxCompleted },
    manualRequests: { pending: mrPending, completed: mrCompleted, unavailable: mrUnavailable },
    delivery: { deliveredToday, failedDeliveries: cancelledDeliveries, successRate: deliverySuccessRate },
    payments: paymentDist,
  };

  _cache = { data, ts: Date.now() };
  return ok(data);
}
