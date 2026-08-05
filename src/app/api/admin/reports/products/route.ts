// ============================================================================
// File: src/app/api/admin/reports/products/route.ts
// Purpose: Top products & low stock report.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, unauthorized, param } from "@/lib/api";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const fromStr = param(req, "from");
  const toStr = param(req, "to");
  // BUG FIX: set "to" to end-of-day so today's orders are included.
  const from = fromStr ? new Date(fromStr) : undefined;
  const toDate = toStr ? new Date(toStr) : undefined;
  if (toDate) toDate.setHours(23, 59, 59, 999);
  const to = toDate;

  const where: any = {};
  if (from || to) {
    where.order = {};
    if (from) where.order.createdAt = { gte: from };
    if (to) where.order.createdAt = { ...(where.order.createdAt || {}), lte: to };
  }

  // Top products by qty sold
  const topRows = await db.orderItem.groupBy({
    by: ["productId"],
    where: { ...where, product: { isNot: null }, order: { status: { not: "cancelled" } } },
    _sum: { qty: true, lineTotal: true },
    orderBy: { _sum: { qty: "desc" } },
    take: 20,
  });

  const ids = topRows.map((r) => r.productId).filter(Boolean) as string[];
  const products = ids.length
    ? await db.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, slug: true, sku: true, brand: { select: { name: true } }, stock: true, mrp: true, sellingPrice: true },
      })
    : [];

  const topProducts = topRows
    .map((r) => {
      const p = products.find((pd) => pd.id === r.productId);
      if (!p) return null;
      return {
        ...p,
        qtySold: r._sum.qty,
        revenue: Number(r._sum.lineTotal ?? 0),
      };
    })
    .filter(Boolean) as Array<any>;

  // Low stock — include sales velocity for restock suggestions
  const lowStockRaw = await db.product.findMany({
    where: { stock: { lte: 10 }, status: "active" },
    orderBy: { stock: "asc" },
    take: 50,
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      lowStockThreshold: true,
      brand: { select: { name: true } },
      sellingPrice: true,
    },
  });

  // Calculate 30-day sales velocity for each low-stock product
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const velocityRows = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: lowStockRaw.map((p) => p.id) },
      order: { status: { not: "cancelled" }, createdAt: { gte: thirtyDaysAgo } },
    },
    _sum: { qty: true },
  });

  const velocityMap = new Map(velocityRows.map((r) => [r.productId, r._sum.qty ?? 0]));

  // Suggested restock = max(lowStockThreshold * 3, 30-day qty sold * 2) - current stock
  // This gives at least 3x the threshold or 2 months of supply, whichever is higher
  const lowStock = lowStockRaw.map((p) => {
    const sold30d = velocityMap.get(p.id) ?? 0;
    const monthlyVelocity = sold30d; // 30-day sales = ~1 month
    const suggestedRestock = Math.max(
      p.lowStockThreshold * 3,
      monthlyVelocity * 2
    ) - p.stock;
    return {
      ...p,
      sold30d,
      suggestedRestock: Math.max(0, suggestedRestock),
      velocityStatus: monthlyVelocity === 0 ? "slow" : monthlyVelocity <= 5 ? "moderate" : "fast",
    };
  });

  return ok({ topProducts, lowStock });
}
