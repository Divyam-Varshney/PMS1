// ============================================================================
// File: src/app/api/admin/dashboard/route.ts
// Purpose: Aggregate stats for the admin dashboard — today's orders & revenue,
//          total customers/products, low-stock count, pending prescriptions &
//          manual requests, orders-by-status breakdown, last-7-days revenue
//          trend, recent orders and top products.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

// ── In-memory cache for the dashboard response. The dashboard makes 30+ DB
//    queries across 2 Promise.all rounds — even parallelized, Supabase free-tier
//    latency makes each round take ~0.5-1s. Caching for 30s means most dashboard
//    loads are instant (0ms). The admin can bypass with ?refresh=1.
// ──
let _dashboardCache: { data: any; ts: number } | null = null;
const DASHBOARD_CACHE_TTL = 30 * 1000; // 30 seconds

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  // Check cache (bypass with ?refresh=1)
  const url = new URL(req.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";
  if (!forceRefresh && _dashboardCache && Date.now() - _dashboardCache.ts < DASHBOARD_CACHE_TTL) {
    return ok(_dashboardCache.data);
  }

  // Use IST (Asia/Calcutta, UTC+5:30) for "today" calculations — the pharmacy
  // is in Mathura, India. Server runs in UTC, so we shift by +5:30.
  const now = new Date();
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET);
  const startOfTodayIST = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate())
  );
  const startOfToday = new Date(startOfTodayIST.getTime() - IST_OFFSET);
  const sevenAgo = new Date(startOfToday);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const startOfMonth = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1)
  );
  startOfMonth.setTime(startOfMonth.getTime() - IST_OFFSET);

  const [
    todayOrders,
    allCustomers,
    newCustomersThisMonth,
    verifiedCustomers,
    allProducts,
    lowStockCountRows,
    pendingPrescriptions,
    pendingManualRequests,
    ordersByStatusRows,
    last7DaysOrders,
    recentOrders,
    topProductRows,
    loyaltyPointsAgg,
    customersWithPoints,
    customersLast7Days,
  ] = await Promise.all([
    db.order.findMany({
      where: { createdAt: { gte: startOfToday }, status: { not: "cancelled" } },
      select: { grandTotal: true },
    }),
    db.customer.count(),
    db.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.customer.count({ where: { isEmailVerified: true } }),
    db.product.count(),
    // Low-stock count — must compare stock <= lowStockThreshold (column-to-
    // column). Prisma's where clause can't express that, so we drop to a raw
    // SQL COUNT. Includes out-of-stock items (stock = 0 satisfies <= threshold)
    // to mirror the previous semantics and keep the dashboard's combined
    // "Low Stock Items" stat card consistent.
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Product"
      WHERE stock <= "lowStockThreshold" AND status = 'active'
    `,
    db.prescription.count({ where: { status: "pending" } }),
    db.manualRequest.count({ where: { status: "pending" } }),
    db.order.groupBy({
      by: ["status"],
      _count: true,
    }),
    db.order.findMany({
      where: { createdAt: { gte: sevenAgo }, status: { not: "cancelled" } },
      select: { createdAt: true, grandTotal: true },
    }),
    db.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        items: { select: { id: true, name: true, qty: true } },
      },
      // NOTE: we don't select ship* snapshot fields here to keep the payload small;
      // the frontend falls back to "Guest" when customer is null. If you need the
      // actual ship name shown on the dashboard, add: select: { shipName: true }
    }),
    db.orderItem.groupBy({
      by: ["productId"],
      _sum: { qty: true },
      where: { product: { isNot: null } },
      orderBy: { _sum: { qty: "desc" } },
      take: 5,
    }),
    // Total loyalty points issued across all customers (sum of loyaltyPoints column).
    db.customer.aggregate({ _sum: { loyaltyPoints: true } }),
    // Count of customers who currently hold a positive loyalty balance.
    db.customer.count({ where: { loyaltyPoints: { gt: 0 } } }),
    // Customers created in the last 7 days (for the dashboard sparkline + trend).
    // Used to power the "Total Customers" stat card's 7-day sparkline.
    db.customer.findMany({
      where: { createdAt: { gte: sevenAgo } },
      select: { createdAt: true },
    }),
  ]);

  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.grandTotal), 0);

  // Low-stock count — convert the raw SQL bigint result to a JS number.
  const lowStockProducts = Number(lowStockCountRows[0]?.count ?? 0);

  // Build last-7-days new-customer series (count of signups per day) — used for
  // the "Total Customers" stat card sparkline + trend indicator.
  const customerDayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    customerDayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const c of customersLast7Days) {
    const key = new Date(c.createdAt).toISOString().slice(0, 10);
    if (customerDayMap.has(key)) {
      customerDayMap.set(key, (customerDayMap.get(key) || 0) + 1);
    }
  }
  const customers7d = Array.from(customerDayMap.entries()).map(([iso, count]) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      count,
    };
  });

  // ── PERFORMANCE OPTIMIZATION: Run ALL remaining queries in a SINGLE
  //    Promise.all block. Previously these were 15+ sequential queries, each
  //    taking ~0.5s due to Supabase network latency (total: ~8-11s). Now they
  //    run in parallel (total: ~0.5-1s). This is the single biggest perf fix.
  // ──

  // Profit period boundaries (IST)
  const profitIstOffset = 5.5 * 60 * 60 * 1000;
  const profitIstNow = new Date(now.getTime() + profitIstOffset);
  const profitStartOfToday = new Date(profitIstNow);
  profitStartOfToday.setUTCHours(0, 0, 0, 0);
  const profitStartOfWeek = new Date(profitStartOfToday);
  profitStartOfWeek.setUTCDate(profitStartOfToday.getUTCDate() - profitStartOfToday.getUTCDay());
  const profitStartOfMonth = new Date(Date.UTC(profitIstNow.getUTCFullYear(), profitIstNow.getUTCMonth(), 1));
  const profitStartOfYear = new Date(Date.UTC(profitIstNow.getUTCFullYear(), 0, 1));

  const thirtyAgo = new Date(now);
  thirtyAgo.setDate(now.getDate() - 29);
  thirtyAgo.setHours(0, 0, 0, 0);

  const todayStart = new Date(startOfToday);

  // Top product IDs (from first Promise.all) — needed for topProductsData
  const topProductIds = topProductRows.map((r) => r.productId).filter(Boolean) as string[];

  // Run ALL remaining queries in parallel
  const [
    totalOrdersCount,
    totalRevenueAgg,
    financialAgg,
    productCostRows,
    todayProfitOrders,
    weekProfitOrders,
    monthProfitOrders,
    yearProfitOrders,
    topProfitableProductRows,
    topCategoryRows,
    topProductsData,
    topCustomerSpend,
    revenueByPaymentMethodRows,
    recentOrders30,
    ordersByPaymentStatusRows,
    lowStockItemRows,
    outOfStockItems,
    todayOrdersAll,
  ] = await Promise.all([
    // All-time totals
    db.order.count(),
    db.order.aggregate({ where: { status: { not: "cancelled" } }, _sum: { grandTotal: true } }),
    // Financial aggregates (discounts + delivery)
    db.order.aggregate({
      where: { status: { not: "cancelled" } },
      _sum: { productDiscount: true, voucherDiscount: true, loyaltyDiscount: true, deliveryCharge: true },
    }),
    // Product cost basis
    db.$queryRaw<Array<{ totalCost: number | null }>>`
      SELECT SUM(oi.qty * p."costPrice") as totalCost
      FROM "OrderItem" oi
      JOIN "Product" p ON oi."productId" = p.id
      JOIN "Order" o ON oi."orderId" = o.id
      WHERE p."costPrice" IS NOT NULL AND oi."productId" IS NOT NULL AND o.status != 'cancelled'
    `,
    // Profit period queries (4 parallel)
    db.order.findMany({
      where: { createdAt: { gte: profitStartOfToday }, status: { notIn: ["cancelled"] } },
      select: { grandTotal: true, items: { select: { qty: true, lineTotal: true, product: { select: { costPrice: true } } } } },
    }),
    db.order.findMany({
      where: { createdAt: { gte: profitStartOfWeek }, status: { notIn: ["cancelled"] } },
      select: { grandTotal: true, items: { select: { qty: true, lineTotal: true, product: { select: { costPrice: true } } } } },
    }),
    db.order.findMany({
      where: { createdAt: { gte: profitStartOfMonth }, status: { notIn: ["cancelled"] } },
      select: { grandTotal: true, items: { select: { qty: true, lineTotal: true, product: { select: { costPrice: true } } } } },
    }),
    db.order.findMany({
      where: { createdAt: { gte: profitStartOfYear }, status: { notIn: ["cancelled"] } },
      select: { grandTotal: true, items: { select: { qty: true, lineTotal: true, product: { select: { costPrice: true } } } } },
    }),
    // Top profitable products
    db.$queryRaw<Array<{ productId: string; productName: string; slug: string; totalQty: bigint; totalRevenue: number; totalCost: number; totalProfit: number }>>`
      SELECT oi."productId", p.name AS "productName", p.slug,
        SUM(oi.qty) AS "totalQty", SUM(oi."lineTotal") AS "totalRevenue",
        SUM(oi.qty * COALESCE(p."costPrice", 0)) AS "totalCost",
        SUM(oi."lineTotal" - (oi.qty * COALESCE(p."costPrice", 0))) AS "totalProfit"
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
      WHERE o.status NOT IN ('cancelled') AND oi."productId" IS NOT NULL
      GROUP BY oi."productId", p.name, p.slug ORDER BY "totalProfit" DESC LIMIT 5
    `,
    // Top categories
    db.$queryRaw<Array<{ categoryId: string; categoryName: string; itemsSold: bigint }>>`
      SELECT c.id AS categoryId, c.name AS categoryName, COALESCE(SUM(oi.qty), 0) AS itemsSold
      FROM "OrderItem" oi JOIN "Product" p ON oi."productId" = p.id JOIN "Category" c ON p."categoryId" = c.id JOIN "Order" o ON oi."orderId" = o.id
      WHERE oi."productId" IS NOT NULL AND o.status != 'cancelled'
      GROUP BY c.id, c.name ORDER BY itemsSold DESC LIMIT 5
    `,
    // Top products data (depends on topProductRows from first Promise.all — already available)
    topProductIds.length
      ? db.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, slug: true, primaryImage: true, brand: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // Top customer spend (last 30 days)
    db.order.groupBy({
      by: ["customerId"],
      where: { customerId: { not: null }, status: { not: "cancelled" }, createdAt: { gte: thirtyAgo } },
      _sum: { grandTotal: true }, _count: true,
      orderBy: { _sum: { grandTotal: "desc" } }, take: 5,
    }),
    // Revenue by payment method
    db.order.groupBy({
      by: ["paymentMethod"],
      _sum: { grandTotal: true }, _count: true,
      where: { status: { not: "cancelled" } },
    }),
    // Recent 30 days orders (for revenue trend)
    db.order.findMany({
      where: { createdAt: { gte: thirtyAgo }, status: { not: "cancelled" } },
      select: { createdAt: true, grandTotal: true },
    }),
    // Orders by payment status
    db.order.groupBy({ by: ["paymentStatus"], _count: true }),
    // Low stock items (raw SQL — column-to-column comparison)
    db.$queryRaw<Array<{ id: string; name: string; slug: string; sku: string | null; stock: number; lowStockThreshold: number; sellingPrice: number; brandName: string | null }>>`
      SELECT p.id, p.name, p.slug, p.sku, p.stock, p."lowStockThreshold", p."sellingPrice", b.name as brandName
      FROM "Product" p LEFT JOIN "Brand" b ON p."brandId" = b.id
      WHERE p.stock <= p."lowStockThreshold" AND p.stock > 0 AND p.status = 'active'
      ORDER BY p.stock ASC LIMIT 6
    `,
    // Out of stock items
    db.product.findMany({
      where: { stock: 0, status: "active" },
      select: { id: true, name: true, slug: true, sku: true, stock: true, lowStockThreshold: true, sellingPrice: true, brand: { select: { name: true } } },
      orderBy: { updatedAt: "desc" }, take: 5,
    }),
    // Today's hourly orders
    db.order.findMany({ where: { createdAt: { gte: todayStart } }, select: { createdAt: true } }),
  ]);

  // ── Process results (no DB queries below this line) ──

  const totalRevenueSum = Number(totalRevenueAgg._sum.grandTotal ?? 0);
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenueSum / totalOrdersCount : 0;

  const completedOrders = ordersByStatusRows.find((r) => r.status === "delivered")?._count ?? 0;
  const cancelledOrders = ordersByStatusRows.find((r) => r.status === "cancelled")?._count ?? 0;

  const totalDiscounts =
    Number(financialAgg._sum.productDiscount ?? 0) +
    Number(financialAgg._sum.voucherDiscount ?? 0) +
    Number(financialAgg._sum.loyaltyDiscount ?? 0);
  const deliveryRevenue = Number(financialAgg._sum.deliveryCharge ?? 0);

  const productCost = Number(productCostRows[0]?.totalCost ?? 0);
  const grossRevenue = totalRevenueSum;
  const estimatedProfit = grossRevenue - productCost;
  const profitMarginPct = grossRevenue > 0 ? (estimatedProfit / grossRevenue) * 100 : 0;

  // Compute profit by period
  function computeProfit(orders: Array<{ grandTotal: any; items: Array<{ qty: number; lineTotal: any; product: { costPrice: any } | null }> }>) {
    const revenue = orders.reduce((s, o) => s + Number(o.grandTotal), 0);
    const cost = orders.reduce((s, o) => s + o.items.reduce((cs, i) => cs + i.qty * (Number(i.product?.costPrice) || 0), 0), 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, cost, profit, margin, orderCount: orders.length };
  }
  const todayProfit = computeProfit(todayProfitOrders);
  const weekProfit = computeProfit(weekProfitOrders);
  const monthProfit = computeProfit(monthProfitOrders);
  const yearProfit = computeProfit(yearProfitOrders);

  const topProfitableProducts = topProfitableProductRows.map((r) => ({
    id: r.productId, name: r.productName, slug: r.slug,
    totalQty: Number(r.totalQty), totalRevenue: Number(r.totalRevenue),
    totalCost: Number(r.totalCost), totalProfit: Number(r.totalProfit),
    margin: Number(r.totalRevenue) > 0 ? (Number(r.totalProfit) / Number(r.totalRevenue)) * 100 : 0,
  }));

  // Build 7-day revenue series
  const dayMap = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), revenue: 0, orders: 0 });
  }
  for (const o of last7DaysOrders) {
    const key = new Date(o.createdAt).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket) { bucket.revenue += Number(o.grandTotal); bucket.orders += 1; }
  }
  const revenueSeries = Array.from(dayMap.values());

  const ordersByStatus = ordersByStatusRows.map((r) => ({ status: r.status, count: r._count }));

  const topCategories = topCategoryRows
    .filter((r) => r.categoryId && r.categoryName)
    .map((r) => ({ categoryId: r.categoryId, categoryName: r.categoryName, itemsSold: Number(r.itemsSold ?? 0) }));

  const topProducts = topProductRows
    .map((r) => {
      const p = topProductsData.find((pd) => pd.id === r.productId);
      if (!p) return null;
      return { ...p, qtySold: r._sum.qty };
    })
    .filter(Boolean) as Array<{ id: string; name: string; slug: string; primaryImage: string | null; brand: { name: string } | null; qtySold: number }>;

  // Top customers — need customer records (depends on topCustomerSpend)
  const topCustomerIds = topCustomerSpend.map((r) => r.customerId).filter(Boolean) as string[];
  const topCustomerRecords = topCustomerIds.length
    ? await db.customer.findMany({
        where: { id: { in: topCustomerIds } },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      })
    : [];
  const topCustomers = topCustomerSpend
    .map((r) => {
      const c = topCustomerRecords.find((cr) => cr.id === r.customerId);
      if (!c) return null;
      return { id: c.id, name: c.name, email: c.email, phone: c.phone, totalSpent: Number(r._sum.grandTotal ?? 0), orderCount: r._count };
    })
    .filter(Boolean) as Array<{ id: string; name: string; email: string; phone: string; totalSpent: number; orderCount: number }>;

  // 30-day revenue trend
  const last30DaysBuckets: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0, 0, 0, 0);
    last30DaysBuckets.push({ date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), revenue: 0, orders: 0 });
  }
  for (const o of recentOrders30) {
    const daysAgo = Math.floor((now.getTime() - new Date(o.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    const idx = last30DaysBuckets.length - 1 - daysAgo;
    if (idx >= 0 && idx < last30DaysBuckets.length) {
      last30DaysBuckets[idx].revenue += Number(o.grandTotal);
      last30DaysBuckets[idx].orders += 1;
    }
  }

  // Hourly orders
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, hourLabel: `${h.toString().padStart(2, "0")}:00`, count: 0 }));
  for (const o of todayOrdersAll) {
    const h = new Date(o.createdAt).getHours();
    hours[h].count++;
  }
  const currentHour = now.getHours();
  const hourlyOrders = hours.filter((h) => h.hour >= 6 && h.hour <= Math.max(currentHour, 6));

  // Low stock items
  const lowStockItems = lowStockItemRows.map((p) => ({
    id: p.id, name: p.name, slug: p.slug, sku: p.sku, stock: p.stock,
    lowStockThreshold: p.lowStockThreshold, sellingPrice: p.sellingPrice,
    brand: p.brandName ? { name: p.brandName } : null,
  }));

  const responseData = {
    todayOrdersCount: todayOrders.length,
    todayRevenue,
    todayRevenueFormatted: formatCurrency(todayRevenue),
    totalCustomers: allCustomers,
    newCustomersThisMonth,
    verifiedCustomers,
    totalProducts: allProducts,
    lowStockCount: lowStockProducts,
    totalOrders: totalOrdersCount,
    totalRevenue: totalRevenueSum,
    avgOrderValue,
    revenueByPaymentMethod: revenueByPaymentMethodRows.map((r) => ({ method: r.paymentMethod, revenue: Number(r._sum.grandTotal ?? 0), count: r._count })),
    last30Days: last30DaysBuckets,
    ordersByPaymentStatus: ordersByPaymentStatusRows.map((r) => ({ status: r.paymentStatus, count: r._count })),
    lowStockItems,
    outOfStockItems,
    pendingPrescriptions,
    pendingManualRequests,
    ordersByStatus,
    revenueSeries,
    customers7d,
    totalLoyaltyPoints: loyaltyPointsAgg._sum.loyaltyPoints ?? 0,
    customersWithPoints,
    completedOrders,
    cancelledOrders,
    totalDiscounts,
    deliveryRevenue,
    grossRevenue,
    productCost,
    estimatedProfit,
    profitMarginPct,
    todayProfit,
    weekProfit,
    monthProfit,
    yearProfit,
    topProfitableProducts,
    recentOrders: recentOrders.map((o) => ({
      id: o.id, orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus,
      grandTotal: o.grandTotal, createdAt: o.createdAt, customer: o.customer,
      shipName: o.shipName, itemsCount: o.items.length,
    })),
    topProducts,
    topCategories,
    topCustomers,
    hourlyOrders,
  };

  // Cache the response for 30s
  _dashboardCache = { data: responseData, ts: Date.now() };

  return ok(responseData);
}
