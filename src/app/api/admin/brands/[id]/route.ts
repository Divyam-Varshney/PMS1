// ============================================================================
// File: src/app/api/admin/brands/[id]/route.ts
// Purpose: Get / update / delete a brand.
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
  const brand = await db.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!brand) return notFound();
  return ok(brand);
}

export async function PUT(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await parseBody<any>(req);
  if (!body) return err("Invalid body", 400);

  const existing = await db.brand.findUnique({ where: { id } });
  if (!existing) return notFound();

  let slug = existing.slug;
  if (body.slug?.trim()) slug = body.slug.trim();
  else if (body.name && body.name !== existing.name) slug = slugify(body.name);
  if (slug !== existing.slug) {
    const dupe = await db.brand.findUnique({ where: { slug } });
    if (dupe && dupe.id !== id) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const updated = await db.brand.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      slug,
      description: body.description !== undefined ? body.description || null : existing.description,
      logo: body.logo !== undefined ? body.logo || null : existing.logo,
      svgIcon: body.svgIcon !== undefined ? body.svgIcon || null : existing.svgIcon,
      featuredImage: body.featuredImage !== undefined ? body.featuredImage || null : existing.featuredImage,
      displayMode: body.displayMode ?? existing.displayMode,
      displayOrder: body.displayOrder != null ? parseInt(body.displayOrder, 10) : existing.displayOrder,
      isFeaturedOnHomepage: body.isFeaturedOnHomepage !== undefined ? body.isFeaturedOnHomepage : existing.isFeaturedOnHomepage,
      status: body.status ?? existing.status,
      visibility: body.visibility ?? existing.visibility,
    },
  });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const inUse = await db.product.findFirst({ where: { brandId: id } });
  if (inUse) {
    await db.brand.update({ where: { id }, data: { status: "inactive" } });
    return ok({ softDeleted: true });
  }
  await db.brand.delete({ where: { id } });
  return ok({ deleted: true });
}
