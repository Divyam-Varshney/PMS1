// ============================================================================
// File: src/app/api/admin/deals/route.ts
// Purpose: Admin-only endpoints for managing "Today's Deals" — promotional
//          entries shown on the customer home page.
//          GET   — list all deals (with optional active-only filter).
//          POST  — create a new deal.
// Role: Powers the Admin Panel → Today's Deals view (list + create).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody, param } from "@/lib/api";

/** Shared include — fetch the linked product so the admin table can show
 *  name/price alongside the deal. */
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

/** GET /api/admin/deals — list all deals, newest first (or by displayOrder). */
export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const activeOnly = param(req, "active") === "true";
  const where = activeOnly ? { isActive: true } : {};

  const items = await db.deal.findMany({
    where,
    include: DEAL_INCLUDE,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return ok({ items });
}

/** POST /api/admin/deals — create a new deal. */
export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

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

  if (!body?.title || !body.title.trim()) return err("Title is required", 400);

  // Validate product if provided.
  if (body.productId) {
    const product = await db.product.findUnique({
      where: { id: body.productId },
      select: { id: true },
    });
    if (!product) return err("Linked product not found", 404);
  }

  // Parse dates — accept ISO strings; null/empty become undefined.
  const startDate = body.startDate ? new Date(body.startDate) : null;
  const endDate = body.endDate ? new Date(body.endDate) : null;
  if (startDate && endDate && startDate > endDate) {
    return err("Start date must be before end date", 400);
  }

  const created = await db.deal.create({
    data: {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      productId: body.productId || null,
      discountPct: Number(body.discountPct) || 0,
      originalPrice: body.originalPrice != null ? Number(body.originalPrice) : null,
      dealPrice: body.dealPrice != null ? Number(body.dealPrice) : null,
      startDate,
      endDate,
      isActive: body.isActive ?? true,
      displayOrder: Number(body.displayOrder) || 0,
    },
    include: DEAL_INCLUDE,
  });

  return ok(created, 201);
}
