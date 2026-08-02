// ============================================================================
// File: src/app/api/admin/deals/[id]/route.ts
// Purpose: Update (PATCH) or delete (DELETE) a single Deal row.
// Role: Powers the Admin Panel → Today's Deals view's edit + delete actions.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const DEAL_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      mrp: true,
      sellingPrice: true,
      primaryImage: true,
      brand: { select: { name: true } },
    },
  },
} as const;

/** PATCH /api/admin/deals/[id] — partial update of any deal field. */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const { id } = await params;
  const existing = await db.deal.findUnique({ where: { id } });
  if (!existing) return notFound();

  const body = await parseBody<{
    title?: string;
    description?: string | null;
    productId?: string | null;
    discountPct?: number;
    originalPrice?: number | null;
    dealPrice?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    isActive?: boolean;
    displayOrder?: number;
  }>(req);
  if (!body) return err("Invalid body", 400);

  // Validate product if provided.
  if (body.productId) {
    const product = await db.product.findUnique({
      where: { id: body.productId },
      select: { id: true },
    });
    if (!product) return err("Linked product not found", 404);
  }

  // Parse dates — null/empty string clears the date.
  let startDate: Date | null | undefined = undefined;
  let endDate: Date | null | undefined = undefined;
  if (body.startDate !== undefined) {
    startDate = body.startDate ? new Date(body.startDate) : null;
  }
  if (body.endDate !== undefined) {
    endDate = body.endDate ? new Date(body.endDate) : null;
  }
  // Validate date range if both are present.
  const finalStart = startDate !== undefined ? startDate : existing.startDate;
  const finalEnd = endDate !== undefined ? endDate : existing.endDate;
  if (finalStart && finalEnd && finalStart > finalEnd) {
    return err("Start date must be before end date", 400);
  }

  const updated = await db.deal.update({
    where: { id },
    data: {
      title: body.title !== undefined ? body.title.trim() : undefined,
      description:
        body.description !== undefined
          ? body.description?.trim() || null
          : undefined,
      productId: body.productId !== undefined ? body.productId || null : undefined,
      discountPct:
        body.discountPct !== undefined ? Number(body.discountPct) || 0 : undefined,
      originalPrice:
        body.originalPrice !== undefined
          ? body.originalPrice != null
            ? Number(body.originalPrice)
            : null
          : undefined,
      dealPrice:
        body.dealPrice !== undefined
          ? body.dealPrice != null
            ? Number(body.dealPrice)
            : null
          : undefined,
      startDate,
      endDate,
      isActive: body.isActive !== undefined ? body.isActive : undefined,
      displayOrder:
        body.displayOrder !== undefined ? Number(body.displayOrder) || 0 : undefined,
    },
    include: DEAL_INCLUDE,
  });

  return ok(updated);
}

/** DELETE /api/admin/deals/[id] — permanently remove a deal. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const { id } = await params;
  const existing = await db.deal.findUnique({ where: { id } });
  if (!existing) return notFound();

  await db.deal.delete({ where: { id } });
  return ok({ deleted: true });
}
