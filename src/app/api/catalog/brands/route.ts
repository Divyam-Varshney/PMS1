// ============================================================================
// File: src/app/api/catalog/brands/route.ts
// Purpose: List active public brands, ordered by displayOrder.
// Role: Powers the shop sidebar filter and home brand strip.
// Caching: Public, s-maxage=60, stale-while-revalidate=300 — brands change
//          rarely and this list is hit on every shop/home load.
// ============================================================================

import { db } from "@/lib/db";
import { okCached } from "@/lib/api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const featuredOnly = url.searchParams.get("featured") === "true";

  const brands = await db.brand.findMany({
    where: {
      status: "active",
      visibility: "public",
      ...(featuredOnly ? { isFeaturedOnHomepage: true } : {}),
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      description: true,
      displayMode: true,
      displayOrder: true,
      isFeaturedOnHomepage: true,
    },
  });
  return okCached(brands);
}
