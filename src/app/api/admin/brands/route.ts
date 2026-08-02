// ============================================================================
// File: src/app/api/admin/brands/route.ts
// Purpose: List & create brands.
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

  const items = await db.brand.findMany({
    where,
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return ok(items);
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<any>(req);
  if (!body?.name) return err("Brand name is required", 400);

  const slug = body.slug?.trim() || slugify(body.name);
  const dupe = await db.brand.findUnique({ where: { slug } });
  const finalSlug = dupe ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

  const brand = await db.brand.create({
    data: {
      name: body.name,
      slug: finalSlug,
      description: body.description || null,
      displayMode: body.displayMode || "both",
      displayOrder: parseInt(body.displayOrder ?? 0, 10),
      status: body.status || "active",
      visibility: body.visibility || "public",
    },
  });
  return ok(brand, 201);
}
