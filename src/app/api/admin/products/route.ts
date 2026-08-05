// ============================================================================
// File: src/app/api/admin/products/route.ts
// Purpose: List/create products. List supports search, category, brand,
//          status, stock filters, sort, and pagination.
//
//          All search queries use mode: "insensitive" for case-insensitive
//          matching (PostgreSQL ILIKE). Sort is server-side for correctness.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody, param, paramInt } from "@/lib/api";
import { slugify } from "@/lib/format";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const search = param(req, "search")?.trim();
  const categoryId = param(req, "categoryId");
  const brandId = param(req, "brandId");
  const status = param(req, "status");
  const stock = param(req, "stock");
  const sort = param(req, "sort") || "newest";
  const page = Math.max(1, paramInt(req, "page", 1));
  const pageSize = Math.min(100, Math.max(1, paramInt(req, "pageSize", 20)));

  // Build the where clause — all conditions are ANDed together.
  // Search uses OR within itself but is ANDed with other filters.
  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { genericName: { contains: search, mode: "insensitive" } },
      { composition: { contains: search, mode: "insensitive" } },
      { manufacturer: { contains: search, mode: "insensitive" } },
      { brand: { name: { contains: search, mode: "insensitive" } } },
      { category: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (categoryId && categoryId !== "all") where.categoryId = categoryId;
  if (brandId && brandId !== "all") where.brandId = brandId;
  if (status && status !== "all") where.status = status;
  // Prescription-required filter — refinement of the existing filter UI so
  // admins can quickly find Rx-only or OTC products.
  const prescription = param(req, "prescription");
  if (prescription === "true") where.prescriptionRequired = true;
  else if (prescription === "false") where.prescriptionRequired = false;

  // Stock filter — uses a numeric threshold (not Prisma field reference)
  if (stock === "out") {
    where.stock = { lte: 0 };
  } else if (stock === "low") {
    // Low stock: stock > 0 AND stock <= 10 (default lowStockThreshold)
    // We use a fixed threshold of 10 here because Prisma doesn't support
    // referencing another column in a where clause directly.
    where.AND = [
      { stock: { gt: 0 } },
      { stock: { lte: 10 } },
    ];
  }

  // Sort mapping — server-side sort for correct pagination
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "price-asc"
      ? [{ sellingPrice: "asc" }]
      : sort === "price-desc"
        ? [{ sellingPrice: "desc" }]
        : sort === "name"
          ? [{ name: "asc" }]
          : sort === "stock"
            ? [{ stock: "desc" }]
            : sort === "oldest"
              ? [{ createdAt: "asc" }]
              : [{ createdAt: "desc" }]; // default: newest

  const [total, items] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      select: {
        id: true, name: true, slug: true, sku: true,
        manufacturer: true, genericName: true, composition: true,
        prescriptionRequired: true, isGeneric: true,
        mrp: true, sellingPrice: true, baseDiscountPct: true,
        stock: true, lowStockThreshold: true,
        status: true, visibility: true,
        isFeatured: true, isBestSeller: true, isTrending: true,
        primaryImage: true, displayOrder: true,
        brandId: true, categoryId: true,
        createdAt: true, updatedAt: true,
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { orderItems: true } },
        // Include the primary ProductImage as a fallback when the denormalized
        // primaryImage cache is NULL. Prevents "missing image" in admin list.
        images: { where: { isPrimary: true }, take: 1, select: { imagePath: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Backfill: if primaryImage is null but a primary ProductImage exists, use it.
  const enriched = items.map((p: any) => ({
    ...p,
    primaryImage: p.primaryImage || p.images?.[0]?.imagePath || null,
    images: undefined, // strip the relation before returning
  }));

  return ok({ items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();

  const body = await parseBody<any>(req);
  if (!body) return err("Invalid body", 400);
  if (!body.name) return err("Product name is required", 400);
  if (body.mrp == null || body.sellingPrice == null)
    return err("MRP and selling price are required", 400);

  const slug = body.slug?.trim() || slugify(body.name);
  const existing = await db.product.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

  const mrp = Number(body.mrp) || 0;
  const sellingPrice = Number(body.sellingPrice) || 0;
  const derivedBase =
    mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 1000) / 10 : 0;
  const baseDiscountPct = body.baseDiscountPct != null ? Number(body.baseDiscountPct) : derivedBase;
  const maxDiscountPct = body.maxDiscountPct != null ? Number(body.maxDiscountPct) : 0;

  const costPrice = body.costPrice != null && body.costPrice !== "" ? Number(body.costPrice) : null;

  const product = await db.product.create({
    data: {
      name: body.name,
      slug: finalSlug,
      sku: body.sku || null,
      shortDescription: body.shortDescription || null,
      description: body.description || null,
      composition: body.composition || null,
      genericName: body.genericName || null,
      manufacturer: body.manufacturer || null,
      hsnCode: body.hsnCode || null,
      prescriptionRequired: body.prescriptionRequired || false,
      isGeneric: body.isGeneric || false,
      brandId: body.brandId || null,
      categoryId: body.categoryId || null,
      unit: body.unit || null,
      packSize: body.packSize || null,
      mrp,
      sellingPrice,
      baseDiscountPct,
      maxDiscountPct,
      costPrice,
      taxPct: Number(body.taxPct) || 0,
      stock: parseInt(body.stock ?? 0, 10),
      lowStockThreshold: parseInt(body.lowStockThreshold ?? 10, 10),
      displayOrder: parseInt(body.displayOrder ?? 0, 10),
      isFeatured: body.isFeatured || false,
      isBestSeller: body.isBestSeller || false,
      isTrending: body.isTrending || false,
      status: body.status || "active",
      visibility: body.visibility || "public",
    },
  });
  return ok(product, 201);
}
