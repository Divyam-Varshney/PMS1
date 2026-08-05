// ============================================================================
// File: src/app/api/catalog/featured/route.ts
// Purpose: Return featured products + best sellers + trending for the home page.
// Role: Single call so HomeView can render multiple carousels efficiently.
// Caching: Public, s-maxage=60, stale-while-revalidate=300 — homepage hits
//          this on every load; product "featured/best-seller/trending" flags
//          change rarely (admin-only).
//
// Performance (Phase 93): Uses a `select` instead of `include` so we don't
//   ship the heavy TEXT/JSON columns (description, galleryImages, hsnCode,
//   costPrice, taxPct, lowStockThreshold) to the browser. The ProductCard
//   only renders a small subset of fields — pruning the rest cuts payload by
//   ~40% on a 36-item response.
// ============================================================================

import { db } from "@/lib/db";
import { okCached } from "@/lib/api";

export async function GET() {
  const where = { status: "active" as const, visibility: "public" as const };
  // Only fetch fields the ProductCard / Quick View modal actually uses.
  // Heavy TEXT/JSON fields (description, galleryImages) are skipped — they
  // bloat the JSON payload without being rendered on the home page.
  const select = {
    id: true,
    name: true,
    slug: true,
    sku: true,
    shortDescription: true,
    composition: true,
    genericName: true,
    manufacturer: true,
    prescriptionRequired: true,
    isGeneric: true,
    brandId: true,
    categoryId: true,
    unit: true,
    packSize: true,
    mrp: true,
    sellingPrice: true,
    baseDiscountPct: true,
    maxDiscountPct: true,
    stock: true,
    primaryImage: true,
    isFeatured: true,
    isBestSeller: true,
    isTrending: true,
    avgRating: true,
    reviewCount: true,
    brand: { select: { id: true, name: true, slug: true, logo: true, displayMode: true } },
    category: { select: { id: true, name: true, slug: true } },
    images: {
      where: { isPrimary: true },
      take: 1,
      select: { imagePath: true, altText: true, isPrimary: true },
    },
  } as const;
  const [featured, bestSellers, trending] = await Promise.all([
    db.product.findMany({ where: { ...where, isFeatured: true }, take: 12, orderBy: { displayOrder: "asc" }, select }),
    db.product.findMany({ where: { ...where, isBestSeller: true }, take: 12, orderBy: { displayOrder: "asc" }, select }),
    db.product.findMany({ where: { ...where, isTrending: true }, take: 12, orderBy: { displayOrder: "asc" }, select }),
  ]);
  return okCached({ featured, bestSellers, trending });
}
