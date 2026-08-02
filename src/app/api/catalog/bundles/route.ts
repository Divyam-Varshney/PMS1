// ============================================================================
// File: src/app/api/catalog/bundles/route.ts
// Purpose: Return all medically-relevant curated bundles with their resolved
//          products. Used by the home page "Medical Bundles" carousel and
//          the dedicated /bundles view.
//
// Strategy:
//   - Fetch all active+public products ONCE (with brand, category, primary
//     image) — bundles resolve in-memory using `resolveAllBundles`.
//   - Cache aggressively (s-maxage=300, swr=600): bundles change rarely
//     (only when products are added/removed or their names change).
//
// Response: { bundles: Array<{ id, name, description, icon, accentColor,
//             accentBg, accentBorder, products: Product[], totalSavings,
//             combinedMrp, combinedPrice, inStockCount }> }
//
// Bundles with 0 matching products are EXCLUDED from the response so the
// home page carousel never shows an empty card.
// ============================================================================

import { db } from "@/lib/db";
import { okCached } from "@/lib/api";
import { resolveAllBundles } from "@/lib/medical-bundles";

export async function GET() {
  // Single query: all active+public products with brand + category + primary
  // image. `displayOrder` is included so the resolver can use it as a
  // tie-breaker (matches the catalog product list ordering).
  //
  // Performance (Phase 93): switched from `include` to `select` to prune the
  // heavy TEXT/JSON columns (description, galleryImages, hsnCode, costPrice,
  // taxPct, lowStockThreshold) — these are never used by the bundle resolver
  // or the bundle card UI. Cuts payload size significantly on large catalogs.
  const products = await db.product.findMany({
    where: { status: "active", visibility: "public" },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
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
      displayOrder: true,
      createdAt: true,
      brand: { select: { id: true, name: true, slug: true, logo: true, displayMode: true } },
      category: { select: { id: true, name: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { imagePath: true, altText: true, isPrimary: true },
      },
    },
  });

  const resolved = resolveAllBundles(products);

  const bundles = resolved.map(({ bundle, products: items }) => {
    // Monetary math: convert Prisma Decimal to JS number BEFORE arithmetic.
    let combinedMrp = 0;
    let combinedPrice = 0;
    let inStockCount = 0;
    for (const p of items) {
      const mrp = Number(p.mrp) || 0;
      const price = Number(p.sellingPrice) || 0;
      const stock = Number(p.stock) || 0;
      combinedMrp += mrp;
      combinedPrice += price;
      if (stock > 0) inStockCount += 1;
    }
    const totalSavings = Math.max(0, combinedMrp - combinedPrice);

    return {
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      icon: bundle.icon,
      accentColor: bundle.accentColor,
      accentBg: bundle.accentBg,
      accentBorder: bundle.accentBorder,
      keywords: bundle.keywords,
      maxItems: bundle.maxItems,
      products: items,
      totalSavings,
      combinedMrp,
      combinedPrice,
      inStockCount,
    };
  });

  return okCached({ bundles }, { sMaxage: 300, swr: 600 });
}
