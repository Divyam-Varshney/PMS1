// ============================================================================
// File: src/app/api/customer/frequently-reordered/route.ts
// Purpose: Returns the products a customer has ordered most frequently (by
//          total quantity across all delivered/confirmed orders). Used to
//          show a "Buy Again" section on the account page.
// Role: Personalized product recommendations based on purchase history.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";

export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login");

  // Aggregate total qty per productId from the customer's non-cancelled orders
  const aggregated = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      order: {
        customerId: customer.id,
        status: { not: "cancelled" },
      },
    },
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take: 8,
  });

  const productIds = aggregated
    .map((r) => r.productId)
    .filter(Boolean) as string[];

  if (productIds.length === 0) {
    return ok({ items: [] });
  }

  // Fetch product details — only active and in-stock products
  const products = await db.product.findMany({
    where: {
      id: { in: productIds },
      status: "active",
      visibility: "public",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      shortDescription: true,
      mrp: true,
      sellingPrice: true,
      primaryImage: true,
      stock: true,
      prescriptionRequired: true,
      brand: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      avgRating: true,
      reviewCount: true,
    },
  });

  // Map back to the aggregated order (preserve sort by qty desc)
  const qtyMap = new Map(aggregated.map((r) => [r.productId, r._sum.qty ?? 0]));
  const items = products
    .map((p) => ({
      ...p,
      timesOrdered: qtyMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.timesOrdered - a.timesOrdered);

  return ok({ items });
}
