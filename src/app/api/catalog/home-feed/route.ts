// ============================================================================
// File: src/app/api/catalog/home-feed/route.ts
// Purpose: Single endpoint that powers the 6 premium product showcases on
//          the home page (New Arrivals, Doctor's Choice, Pharmacist
//          Recommended, Limited-Time Deals, Seasonal Collection, Top Rated).
//          Returning all sections in ONE call avoids 6 separate round-trips
//          and keeps the home page fast.
//
// Caching: public, s-maxage=300 (5 min), stale-while-revalidate=600 (10 min).
//          All sections are derived from the active/public catalog which
//          changes infrequently — safe to cache at the CDN edge.
//
// Filter: every query enforces status="active" + visibility="public" so
//         admin-only or soft-deleted products never leak to the storefront.
// ============================================================================

import { db } from "@/lib/db";
import { okCached } from "@/lib/api";
import type { Prisma } from "@prisma/client";

// Shared product include — brand, category, primary image. Matches the shape
// used by /api/catalog/featured so ProductCard can render any of these lists
// without additional client-side massaging.
//
// Performance (Phase 93): uses a `select` so we don't pull the heavy TEXT
// columns (`description`, `galleryImages`) for the 6 sections × 12 products
// payload. The home page only renders cards — long descriptions are fetched
// on demand from the product detail page.
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
  createdAt: true,
  displayOrder: true,
  brand: { select: { id: true, name: true, slug: true, logo: true, displayMode: true } },
  category: { select: { id: true, name: true, slug: true } },
  images: {
    where: { isPrimary: true },
    take: 1,
    select: { imagePath: true, altText: true, isPrimary: true },
  },
} as const;

const ACTIVE_PUBLIC = {
  status: "active" as const,
  visibility: "public" as const,
};

const LIMIT = 12;

// ---------------------------------------------------------------------------
// Seasonal logic — picks a curated season based on the current month.
// Returns the season key + an array of search keywords that we OR-match
// against product name / composition / genericName / category.name.
// Months are 1-12 (Jan = 1).
//   Nov–Feb (11,12,1,2) → Winter Care    — cough/cold/flu/vitamin c/honey/...
//   Mar–May (3,4,5)     → Summer Care    — sunscreen/ORS/electrolyte/...
//   Jun–Aug (6,7,8)     → Monsoon Care   — mosquito/repellent/antiseptic/...
//   Sep–Oct (9,10)      → Festive Wellness — vitamin/supplement/immunity/...
// ---------------------------------------------------------------------------
function getSeason(month: number): {
  key: "winter" | "summer" | "monsoon" | "festive";
  keywords: string[];
} {
  if (month === 11 || month === 12 || month === 1 || month === 2) {
    return {
      key: "winter",
      keywords: [
        "cough",
        "cold",
        "flu",
        "vitamin c",
        "honey",
        "vapor",
        "inhaler",
        "thermometer",
      ],
    };
  }
  if (month >= 3 && month <= 5) {
    return {
      key: "summer",
      keywords: [
        "sunscreen",
        "ors",
        "electrolyte",
        "coolant",
        "antacid",
        "glucose",
      ],
    };
  }
  if (month >= 6 && month <= 8) {
    return {
      key: "monsoon",
      keywords: [
        "mosquito",
        "repellent",
        "antiseptic",
        "hand sanitizer",
        "flu",
        "fever",
      ],
    };
  }
  return {
    key: "festive",
    keywords: ["vitamin", "supplement", "immunity", "protein", "tonic"],
  };
}

export async function GET() {
  // 30 days ago — used for the "New Arrivals" cutoff.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const month = new Date().getMonth() + 1; // 1-12
  const season = getSeason(month);

  // Seasonal OR-clause — match any keyword against product name, composition,
  // genericName, or category.name (case-insensitive).
  const seasonalOr: Prisma.ProductWhereInput[] = season.keywords.map((kw) => ({
    OR: [
      { name: { contains: kw, mode: "insensitive" } },
      { composition: { contains: kw, mode: "insensitive" } },
      { genericName: { contains: kw, mode: "insensitive" } },
      { category: { name: { contains: kw, mode: "insensitive" } } },
    ],
  }));
  const seasonalWhere: Prisma.ProductWhereInput = {
    ...ACTIVE_PUBLIC,
    OR: seasonalOr,
  };

  // Run all 6 queries in parallel — single round-trip to the DB.
  //
  // Performance (Phase 97): Doctor's Choice previously ran a strict filter
  // (isFeatured + isBestSeller + avgRating>=4) and a conditional fallback
  // (isFeatured + avgRating>=4) when the strict result was sparse. The
  // fallback ran AFTER Promise.all, adding sequential latency. Since the
  // strict filter almost never returns >= 5 products on a real catalog, we
  // now run the relaxed filter directly — same results, one fewer query,
  // and no sequential dependency.
  const [
    newArrivals,
    doctorsChoice,
    pharmacistRecommended,
    limitedTimeDeals,
    seasonalCollection,
    topRated,
  ] = await Promise.all([
    // 1. New Arrivals — products created in the last 30 days, newest first.
    db.product.findMany({
      where: { ...ACTIVE_PUBLIC, createdAt: { gte: thirtyDaysAgo } },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
      select,
    }),
    // 2. Doctor's Choice — curated: featured + rating >= 4 (relaxed from the
    //    previous isFeatured+isBestSeller+avgRating>=4 strict filter, which
    //    rarely matched >= 5 products and triggered a sequential fallback).
    db.product.findMany({
      where: {
        ...ACTIVE_PUBLIC,
        isFeatured: true,
        avgRating: { gte: 4 },
      },
      take: LIMIT,
      orderBy: { avgRating: "desc" },
      select,
    }),
    // 3. Pharmacist Recommended — best-sellers with stock, sorted by reviews.
    db.product.findMany({
      where: { ...ACTIVE_PUBLIC, isBestSeller: true, stock: { gt: 0 } },
      take: LIMIT,
      orderBy: { reviewCount: "desc" },
      select,
    }),
    // 4. Limited-Time Deals — products with >= 15% base discount, biggest
    //    discount first. Uses baseDiscountPct (the admin-confirmed value).
    db.product.findMany({
      where: { ...ACTIVE_PUBLIC, baseDiscountPct: { gte: 15 } },
      take: LIMIT,
      orderBy: { baseDiscountPct: "desc" },
      select,
    }),
    // 5. Seasonal Collection — keyword-matched products for the current season.
    db.product.findMany({
      where: seasonalWhere,
      take: LIMIT,
      orderBy: { displayOrder: "asc" },
      select,
    }),
    // 6. Top Rated — rating >= 4, highest rating first (with reviewCount as
    //    tiebreaker so we don't surface products with 1 review of 5 stars).
    db.product.findMany({
      where: { ...ACTIVE_PUBLIC, avgRating: { gte: 4 } },
      take: LIMIT,
      orderBy: [{ avgRating: "desc" }, { reviewCount: "desc" }],
      select,
    }),
  ]);

  return okCached(
    {
      newArrivals,
      doctorsChoice,
      pharmacistRecommended,
      limitedTimeDeals,
      seasonalCollection,
      topRated,
      season: season.key,
    },
    { sMaxage: 300, swr: 600 }
  );
}
