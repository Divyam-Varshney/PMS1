// ============================================================================
// File: src/app/api/admin/orders/[id]/items/route.ts
// Purpose: Add a product to an existing order. Recomputes totals via the
//          shared discount engine (calculateOrderTotals).
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { calculateOrderTotals, EngineLineInput } from "@/lib/pricing-engine";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;

  const body = await parseBody<{ productId?: string; qty?: number }>(req);
  if (!body?.productId) return err("productId is required", 400);
  const qty = Math.max(1, parseInt(String(body.qty ?? 1), 10));

  const order = await db.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) return notFound("Order not found");
  if (order.status === "cancelled" || order.status === "delivered") {
    return err("Cannot modify a delivered/cancelled order", 400);
  }

  const product = await db.product.findUnique({
    where: { id: body.productId },
    include: { brand: true, category: true },
  });
  if (!product) return notFound("Product not found");

  // Build engine input from existing items + the new one
  // Existing order items are reconstructed from their snapshot: we use the
  // stored `appliedDiscountPct` as BOTH baseDiscountPct and maxDiscountPct so
  // the engine re-applies exactly the same per-line discount (no upgrade).
  // The newly-added line uses the live Product's baseDiscountPct/maxDiscountPct.
  const baseLines: EngineLineInput[] = order.items.map((it) => ({
    productId: it.productId || "unknown",
    name: it.name,
    sku: it.sku,
    image: it.image,
    qty: it.qty,
    mrp: Number(it.mrp),
    sellingPrice: Number(it.sellingPrice),
    baseDiscountPct: Number(it.appliedDiscountPct ?? 0),
    maxDiscountPct: Number(it.appliedDiscountPct ?? 0),
  }));

  baseLines.push({
    productId: product.id,
    name: product.name,
    sku: product.sku,
    image: product.primaryImage,
    qty,
    mrp: Number(product.mrp),
    sellingPrice: Number(product.sellingPrice),
    baseDiscountPct: Number(product.baseDiscountPct ?? 0),
    maxDiscountPct: Number(product.maxDiscountPct ?? 0),
    categoryId: product.categoryId,
    brandId: product.brandId,
    isGeneric: product.isGeneric,
  });

  const totals = await calculateOrderTotals(baseLines, {
    voucherCode: order.voucherCode || undefined,
    pincode: order.shipPincode,
  });

  // Delete existing items, then recreate with the fresh engine output
  await db.orderItem.deleteMany({ where: { orderId: id } });
  await db.orderItem.createMany({
    data: totals.lines.map((l) => ({
      orderId: id,
      productId: l.productId === "unknown" ? null : l.productId,
      name: l.name,
      sku: l.sku ?? null,
      image: l.image ?? null,
      qty: l.qty,
      mrp: l.mrp,
      sellingPrice: l.sellingPrice,
      appliedDiscountPct: l.appliedDiscountPct,
      discountAmount: l.discountAmount,
      lineTotal: l.finalLineTotal,
    })),
  });

  const updated = await db.order.update({
    where: { id },
    data: {
      itemsTotal: totals.itemsTotal,
      productDiscount: totals.productDiscount,
      voucherDiscount: totals.voucherDiscount,
      voucherCode: totals.voucherCode || order.voucherCode,
      deliveryCharge: totals.deliveryCharge,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      roundOff: totals.roundOff,
    },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      items: { include: { product: { select: { id: true, name: true, primaryImage: true, stock: true } } } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  return ok(updated);
}
