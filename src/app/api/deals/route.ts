// ============================================================================
// File: src/app/api/deals/route.ts
// Purpose: PUBLIC endpoint — returns the active "Today's Deals" for display on
//          the customer home page. No auth required.
//
// Filters:
//   - isActive === true
//   - startDate is null OR <= now
//   - endDate   is null OR >= now
// Sorted by displayOrder, then createdAt.
// Each item includes the linked product (id/name/slug/mrp/sellingPrice/image/
// brand) so the customer UI can render a deal card with the discounted price.
// ============================================================================

import { db } from "@/lib/db";
import { ok } from "@/lib/api";

const DEAL_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      mrp: true,
      sellingPrice: true,
      primaryImage: true,
      prescriptionRequired: true,
      brand: { select: { name: true } },
      // Include the ProductImage records (primary only) so the frontend
      // ProductImage component can use the REAL primary image instead of the
      // denormalized `primaryImage` cache field, which can go stale if the
      // admin reorders/replaces images. This fixes the bug where "Today's
      // Deals" showed the wrong image (or alt text) while other sections
      // showed the correct one.
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { imagePath: true, altText: true, isPrimary: true },
      },
    },
  },
} as const;

export async function GET() {
  const now = new Date();
  const items = await db.deal.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    include: DEAL_INCLUDE,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return ok({ items });
}
