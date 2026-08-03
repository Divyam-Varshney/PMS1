// ============================================================================
// File: src/app/api/campaigns/[slug]/route.ts
// Purpose: Public endpoint — returns a published campaign by slug, with
//          featured products + categories fully resolved. Used by the
//          customer-facing campaign landing page.
// ============================================================================

import { db } from "@/lib/db";
import { ok, notFound } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;

  const campaign = await db.campaign.findUnique({ where: { slug } });
  if (!campaign) return notFound("Campaign not found");

  // Only return published campaigns (or scheduled within date range)
  if (campaign.status !== "published") {
    return notFound("Campaign not found");
  }

  // Check scheduling
  const now = new Date();
  if (campaign.startDate && now < campaign.startDate) {
    return notFound("Campaign not found");
  }
  if (campaign.endDate && now > campaign.endDate) {
    return notFound("Campaign not found");
  }

  // Parse featured product + category IDs
  let productIds: string[] = [];
  let categoryIds: string[] = [];
  try {
    productIds = campaign.productIds ? JSON.parse(campaign.productIds) : [];
  } catch { /* ignore */ }
  try {
    categoryIds = campaign.categoryIds ? JSON.parse(campaign.categoryIds) : [];
  } catch { /* ignore */ }

  // Fetch featured products + categories in parallel
  const [products, categories] = await Promise.all([
    productIds.length
      ? db.product.findMany({
          where: { id: { in: productIds }, status: "active", visibility: "public" },
          include: {
            brand: { select: { id: true, name: true, slug: true } },
            images: { where: { isPrimary: true }, take: 1, select: { imagePath: true, altText: true } },
          },
        })
      : Promise.resolve([]),
    categoryIds.length
      ? db.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, slug: true, image: true },
        })
      : Promise.resolve([]),
  ]);

  return ok({
    ...campaign,
    products,
    categories,
  });
}
