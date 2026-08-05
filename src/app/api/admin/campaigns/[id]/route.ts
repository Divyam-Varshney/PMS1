// ============================================================================
// File: src/app/api/admin/campaigns/[id]/route.ts
// Purpose: Get / update / delete a single campaign. Admin-only.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { slugify } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return notFound("Campaign not found");
  return ok(campaign);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const existing = await db.campaign.findUnique({ where: { id } });
  if (!existing) return notFound("Campaign not found");

  const body = await parseBody<Record<string, any>>(req);
  if (!body) return err("No data provided", 400);

  // Build update data — only update provided fields
  const data: any = {};
  const fields = [
    "title", "type", "status", "bannerImage", "heroTitle", "heroSubtitle",
    "heroCtaText", "heroCtaLink", "promoText", "productIds", "categoryIds",
    "seoTitle", "metaDescription", "displayOrder",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f] || null;
  }

  // Handle slug separately (needs uniqueness check)
  if (body.slug !== undefined) {
    const newSlug = slugify(body.slug);
    if (newSlug !== existing.slug) {
      const conflict = await db.campaign.findUnique({ where: { slug: newSlug } });
      if (conflict) return err("A campaign with this slug already exists", 400);
      data.slug = newSlug;
    }
  }

  // Handle dates
  if (body.startDate !== undefined) {
    data.startDate = body.startDate ? new Date(body.startDate) : null;
  }
  if (body.endDate !== undefined) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }

  const updated = await db.campaign.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const existing = await db.campaign.findUnique({ where: { id } });
  if (!existing) return notFound("Campaign not found");

  await db.campaign.delete({ where: { id } });
  return ok({ deleted: true });
}
