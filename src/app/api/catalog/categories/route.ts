// ============================================================================
// File: src/app/api/catalog/categories/route.ts
// Purpose: List active public categories, ordered by displayOrder.
// Role: Powers the shop sidebar filter and home category chips.
// Caching: Public, s-maxage=60, stale-while-revalidate=300 — categories and
//          their product counts change infrequently.
// ============================================================================

import { db } from "@/lib/db";
import { okCached } from "@/lib/api";

export async function GET() {
  const categories = await db.category.findMany({
    where: { status: "active", visibility: "public" },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      description: true,
      displayOrder: true,
      _count: { select: { products: true } },
    },
  });
  // Flatten _count.products -> productCount for a cleaner public payload.
  const flat = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    image: c.image,
    description: c.description,
    displayOrder: c.displayOrder,
    productCount: c._count.products,
  }));
  return okCached(flat);
}
