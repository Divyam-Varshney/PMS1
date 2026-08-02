// ============================================================================
// File: src/app/api/admin/categories/[id]/route.ts
// Purpose: Get / update / delete a category.
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
  const cat = await db.category.findUnique({
    where: { id },
    include: { parent: true, _count: { select: { products: true } } },
  });
  if (!cat) return notFound();
  return ok(cat);
}

export async function PUT(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await parseBody<any>(req);
  if (!body) return err("Invalid body", 400);

  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) return notFound();

  let slug = existing.slug;
  if (body.slug?.trim()) slug = body.slug.trim();
  else if (body.name && body.name !== existing.name) slug = slugify(body.name);
  if (slug !== existing.slug) {
    const dupe = await db.category.findUnique({ where: { slug } });
    if (dupe && dupe.id !== id) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const updated = await db.category.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      slug,
      description: body.description !== undefined ? body.description || null : existing.description,
      image: body.image !== undefined ? body.image || null : existing.image,
      parentId: body.parentId !== undefined ? body.parentId || null : existing.parentId,
      displayOrder: body.displayOrder != null ? parseInt(body.displayOrder, 10) : existing.displayOrder,
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
  const inUse = await db.product.findFirst({ where: { categoryId: id } });
  if (inUse) {
    await db.category.update({ where: { id }, data: { status: "inactive" } });
    return ok({ softDeleted: true });
  }
  await db.category.delete({ where: { id } });
  return ok({ deleted: true });
}
