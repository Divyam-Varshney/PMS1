// ============================================================================
// File: src/app/api/catalog/products/route.ts
// Purpose: List products with ALL filters: query, category, brand, price range,
//          availability, prescription, generic, sort, and pagination.
//
//          All filters are SERVER-SIDE for correct results across pages.
//          Search uses mode: "insensitive" for case-insensitive matching.
//
// Caching: Public, s-maxage=30, stale-while-revalidate=300.
// ============================================================================

import { db } from "@/lib/db";
import { okCached, param, paramInt } from "@/lib/api";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const query = param(req, "query")?.trim() || undefined;
  const categoryId = param(req, "categoryId");
  const brandId = param(req, "brandId");
  const sort = param(req, "sort") || "popular";
  const page = Math.max(1, paramInt(req, "page", 1));
  const limit = Math.min(48, Math.max(1, paramInt(req, "limit", 12)));
  const featured = param(req, "featured") === "true";
  const bestSeller = param(req, "bestSeller") === "true";
  const trending = param(req, "trending") === "true";
  const prescription = param(req, "prescription");
  const isGeneric = param(req, "isGeneric");

  // Price range filters (server-side for correct pagination)
  const priceMin = paramInt(req, "priceMin", 0);
  const priceMax = paramInt(req, "priceMax", 0);

  // Availability filter: "inStock" = stock > 0, "outOfStock" = stock <= 0
  const availability = param(req, "availability");

  // Discount filter: minimum discount percentage
  const minDiscount = paramInt(req, "minDiscount", 0);

  const where: Prisma.ProductWhereInput = {
    status: "active",
    visibility: "public",
  };

  // Search — case-insensitive across multiple fields + brand name
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { shortDescription: { contains: query, mode: "insensitive" } },
      { composition: { contains: query, mode: "insensitive" } },
      { genericName: { contains: query, mode: "insensitive" } },
      { manufacturer: { contains: query, mode: "insensitive" } },
      { sku: { contains: query, mode: "insensitive" } },
      { brand: { name: { contains: query, mode: "insensitive" } } },
      { category: { name: { contains: query, mode: "insensitive" } } },
    ];
  }

  if (categoryId) where.categoryId = categoryId;
  if (brandId) where.brandId = brandId;
  if (featured) where.isFeatured = true;
  if (bestSeller) where.isBestSeller = true;
  if (trending) where.isTrending = true;
  if (prescription === "required") where.prescriptionRequired = true;
  if (prescription === "otc") where.prescriptionRequired = false;
  if (isGeneric === "true") where.isGeneric = true;

  // Price range filter — server-side for correct pagination
  if (priceMin > 0 || priceMax > 0) {
    where.sellingPrice = {};
    if (priceMin > 0) where.sellingPrice.gte = priceMin;
    if (priceMax > 0) where.sellingPrice.lte = priceMax;
  }

  // Availability filter
  if (availability === "inStock") {
    where.stock = { gt: 0 };
  } else if (availability === "outOfStock") {
    where.stock = { lte: 0 };
  }

  // Discount filter — minimum discount percentage
  if (minDiscount > 0) {
    where.baseDiscountPct = { gte: minDiscount };
  }

  // Sort mapping
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "price-asc"
      ? [{ sellingPrice: "asc" }]
      : sort === "price-desc"
        ? [{ sellingPrice: "desc" }]
        : sort === "newest"
          ? [{ createdAt: "desc" }]
          : sort === "best-discount"
            ? [{ baseDiscountPct: "desc" }]
            : sort === "rating"
              ? [{ avgRating: "desc" }]
              : [{ displayOrder: "asc" }, { createdAt: "desc" }]; // popular

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      // Select only the fields the shop / product card uses. Pruning heavy
      // TEXT/JSON columns (description, galleryImages, hsnCode, costPrice,
      // taxPct, lowStockThreshold) keeps the listing payload small and the
      // response fast, even on slow connections.
      select: {
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
      },
    }),
    db.product.count({ where }),
  ]);

  return okCached({ items, total, page, limit }, { sMaxage: 30, swr: 300 });
}
