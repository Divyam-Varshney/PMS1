// ============================================================================
// File: src/app/api/admin/products/[id]/route.ts
// Purpose: Get / update / delete a single product.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { slugify } from "@/lib/format";
import { notifyBackInStock } from "@/lib/stock-notifier";
import { storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: {
      brand: true,
      category: true,
      reviews: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });
  if (!product) return notFound("Product not found");
  return ok(product);
}

export async function PUT(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await parseBody<any>(req);
  if (!body) return err("Invalid body", 400);

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) return notFound("Product not found");

  // If name changed & slug not provided, regenerate slug
  let slug = existing.slug;
  if (body.slug?.trim()) slug = body.slug.trim();
  else if (body.name && body.name !== existing.name) slug = slugify(body.name);

  if (slug !== existing.slug) {
    const dupe = await db.product.findUnique({ where: { slug } });
    if (dupe && dupe.id !== id) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }
  }

  // Derive baseDiscountPct from MRP → sellingPrice if not explicitly provided.
  // maxDiscountPct defaults to 0 — NOT auto-set from baseDiscountPct.
  const mrp = body.mrp != null ? Number(body.mrp) : Number(existing.mrp);
  const sellingPrice =
    body.sellingPrice != null ? Number(body.sellingPrice) : Number(existing.sellingPrice);
  const derivedBasePct =
    mrp > 0
      ? Math.round(((mrp - sellingPrice) / mrp) * 1000) / 10
      : 0;
  const baseDiscountPct =
    body.baseDiscountPct != null ? Number(body.baseDiscountPct) : derivedBasePct;
  // Only update maxDiscountPct if explicitly provided; otherwise preserve existing.
  const maxDiscountPct =
    body.maxDiscountPct != null ? Number(body.maxDiscountPct) : Number(existing.maxDiscountPct);
  const costPrice =
    body.costPrice !== undefined
      ? (body.costPrice !== "" && body.costPrice != null ? Number(body.costPrice) : null)
      : (existing.costPrice != null ? Number(existing.costPrice) : null);

  const updated = await db.product.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      slug,
      sku: body.sku !== undefined ? body.sku || null : existing.sku,
      shortDescription: body.shortDescription !== undefined ? body.shortDescription || null : existing.shortDescription,
      description: body.description !== undefined ? body.description || null : existing.description,
      composition: body.composition !== undefined ? body.composition || null : existing.composition,
      genericName: body.genericName !== undefined ? body.genericName || null : existing.genericName,
      manufacturer: body.manufacturer !== undefined ? body.manufacturer || null : existing.manufacturer,
      hsnCode: body.hsnCode !== undefined ? body.hsnCode || null : existing.hsnCode,
      prescriptionRequired: body.prescriptionRequired ?? existing.prescriptionRequired,
      isGeneric: body.isGeneric ?? existing.isGeneric,
      brandId: body.brandId !== undefined ? body.brandId || null : existing.brandId,
      categoryId: body.categoryId !== undefined ? body.categoryId || null : existing.categoryId,
      unit: body.unit !== undefined ? body.unit || null : existing.unit,
      packSize: body.packSize !== undefined ? body.packSize || null : existing.packSize,
      mrp,
      sellingPrice,
      baseDiscountPct,
      maxDiscountPct,
      costPrice,
      taxPct: body.taxPct != null ? Number(body.taxPct) : Number(existing.taxPct),
      stock: body.stock != null ? parseInt(body.stock, 10) : existing.stock,
      lowStockThreshold: body.lowStockThreshold != null ? parseInt(body.lowStockThreshold, 10) : existing.lowStockThreshold,
      displayOrder: body.displayOrder != null ? parseInt(body.displayOrder, 10) : existing.displayOrder,
      isFeatured: body.isFeatured ?? existing.isFeatured,
      isBestSeller: body.isBestSeller ?? existing.isBestSeller,
      isTrending: body.isTrending ?? existing.isTrending,
      status: body.status ?? existing.status,
      visibility: body.visibility ?? existing.visibility,
      primaryImage: body.primaryImage !== undefined ? body.primaryImage || null : existing.primaryImage,
      galleryImages: body.galleryImages !== undefined ? body.galleryImages || null : existing.galleryImages,
    },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  // Back-in-stock notification: if stock transitioned from 0 → positive,
  // notify all customers who subscribed to restock alerts.
  if (body.stock != null) {
    const newStock = parseInt(body.stock, 10);
    await notifyBackInStock(id, existing.stock, newStock);
  }

  return ok(updated);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  // Check if this is a permanent delete (for trashed products only)
  const url = new URL(req.url);
  const permanent = url.searchParams.get("permanent") === "true";

  if (permanent) {
    // ── Permanent delete: only allowed for trashed products ──
    const product = await db.product.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!product) return notFound("Product not found");
    if (product.status !== "trashed") {
      return err("Product must be trashed before permanent deletion. Move to trash first.", 400);
    }
    // Check if product is referenced by orders
    const referenced = await db.orderItem.findFirst({ where: { productId: id } });
    if (referenced) {
      return err("Cannot permanently delete a product with orders. Keep it trashed.", 400);
    }

    // Clean up cloud storage + related DB records
    const images = await db.productImage.findMany({
      where: { productId: id },
      select: { id: true, imagePath: true },
    });
    for (const img of images) {
      await storage.delete("products", img.imagePath).catch(() => {});
    }
    await db.productImage.deleteMany({ where: { productId: id } });
    await db.cartItem.deleteMany({ where: { productId: id } });
    await db.wishlistItem.deleteMany({ where: { productId: id } });
    await db.stockSubscription.deleteMany({ where: { productId: id } }).catch(() => {});
    await db.review.deleteMany({ where: { productId: id } }).catch(() => {});
    await db.deal.deleteMany({ where: { productId: id } }).catch(() => {});
    await db.product.delete({ where: { id } });
    return ok({ deleted: true, imagesCleanedUp: images.length });
  }

  // ── Default: soft-delete (move to trash) ──
  // Products are moved to "trashed" status (recoverable) instead of being
  // permanently deleted. This prevents accidental data loss.
  await db.product.update({
    where: { id },
    data: { status: "trashed", visibility: "hidden" },
  });
  return ok({ trashed: true });
}
