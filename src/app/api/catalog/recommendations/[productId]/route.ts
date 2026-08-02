// ============================================================================
// File: src/app/api/catalog/recommendations/[productId]/route.ts
// Purpose: Per-product recommendation engine. Returns three sets:
//            - related          (top 8 by medical-relevance score)
//            - frequentlyBought (top 3 complementary items, e.g. Dettol → bandages)
//            - alternatives     (top 4 same-generic, different-brand — usually
//                                cheaper / generic substitutes)
//
// Strategy:
//   - Fetch all active+public products ONCE (with brand, category, primary
//     image) — the engine runs entirely in-memory.
//   - Cache with okCached(sMaxage: 60, swr: 300) — recommendations change
//     only when products or their fields change.
//
// Response: { related, frequentlyBought, alternatives }
// ============================================================================

import { db } from "@/lib/db";
import { okCached, notFound } from "@/lib/api";
import {
  getRelatedProducts,
  getFrequentlyBought,
  getGenericAlternatives,
  type RecommendationProductLike,
} from "@/lib/recommendation-engine";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;

  // Single query: all active+public products with brand + category + primary
  // image. We use this same list for the current product lookup AND the
  // candidate pool — one DB round-trip total.
  const allProducts = await db.product.findMany({
    where: { status: "active", visibility: "public" },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: {
      brand: { select: { id: true, name: true, slug: true, logo: true, displayMode: true } },
      category: { select: { id: true, name: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { imagePath: true, altText: true, isPrimary: true },
      },
    },
  });

  // Find the current product (by id OR slug — the SPA may pass either).
  const current = allProducts.find(
    (p) => p.id === productId || p.slug === productId
  );
  if (!current) return notFound("Product not found");

  // The engine is typed against RecommendationProductLike — Prisma's Product
  // type is structurally compatible (id, name, composition, genericName,
  // categoryId, brandId, brand { name }, category { name }, etc. all match).
  const pool = allProducts as unknown as RecommendationProductLike[];
  const currentTyped = current as unknown as RecommendationProductLike;

  const related = getRelatedProducts(currentTyped, pool, 8);
  const frequentlyBought = getFrequentlyBought(currentTyped, pool, 3);
  const alternatives = getGenericAlternatives(currentTyped, pool, 4);

  return okCached(
    { related, frequentlyBought, alternatives },
    { sMaxage: 60, swr: 300 }
  );
}
