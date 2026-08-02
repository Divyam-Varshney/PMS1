// ============================================================================
// File: src/app/api/admin/categories/route.ts
// Purpose: List & create categories (supports parent-child nesting).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody, param } from "@/lib/api";
import { slugify } from "@/lib/format";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const search = param(req, "search")?.trim();
  const where: any = {};
  if (search) where.name = { contains: search };

  const items = await db.category.findMany({
    where,
    orderBy: { displayOrder: "asc" },
    include: {
      _count: { select: { products: true } },
      parent: { select: { id: true, name: true } },
    },
  });
  return ok(items);
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<any>(req);
  if (!body?.name) return err("Category name is required", 400);

  const slug = body.slug?.trim() || slugify(body.name);
  const dupe = await db.category.findUnique({ where: { slug } });
  const finalSlug = dupe ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

  const cat = await db.category.create({
    data: {
      name: body.name,
      slug: finalSlug,
      description: body.description || null,
      parentId: body.parentId || null,
      displayOrder: parseInt(body.displayOrder ?? 0, 10),
      status: body.status || "active",
      visibility: body.visibility || "public",
    },
  });
  return ok(cat, 201);
}
