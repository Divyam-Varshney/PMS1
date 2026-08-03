// ============================================================================
// File: src/app/api/admin/orders/[id]/item/[itemId]/route.ts
// Purpose: Update qty or delete an order line. Recomputes totals via the
//          shared discount engine.
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";
import { calculateOrderTotals, EngineLineInput } from "@/lib/pricing-engine";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

async function recompute(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return null;

  // Reconstruct engine inputs from the stored OrderItem snapshot. We use the
  // stored `appliedDiscountPct` as BOTH baseDiscountPct and maxDiscountPct so
  // the engine re-applies exactly the same per-line discount (no upgrade).
  const lines: EngineLineInput[] = order.items.map((it) => ({
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

  const totals = await calculateOrderTotals(lines, {
    voucherCode: order.voucherCode || undefined,
    pincode: order.shipPincode,
  });

  // Delete + recreate items
  await db.orderItem.deleteMany({ where: { orderId } });
  await db.orderItem.createMany({
    data: totals.lines.map((l) => ({
      orderId,
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
    where: { id: orderId },
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
  return updated;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id, itemId } = await params;

  const body = await parseBody<{ qty?: number }>(req);
  if (!body?.qty || body.qty < 1) return err("qty must be >= 1", 400);

  const order = await db.order.findUnique({ where: { id } });
  if (!order) return notFound("Order not found");
  // Item quantities can only be updated while the order is still in
  // pre-fulfillment stages (pending / confirmed). Once packed, locked.
  if (
    order.status === "cancelled" ||
    order.status === "delivered" ||
    order.status === "packed" ||
    order.status === "out_for_delivery" ||
    order.status === "returned"
  ) {
    return err(
      "Items are locked once the order is packed. Only pending or confirmed orders can be modified.",
      400
    );
  }

  const item = await db.orderItem.findUnique({ where: { id: itemId } });
  if (!item || item.orderId !== id) return notFound("Item not found");

  await db.orderItem.update({ where: { id: itemId }, data: { qty: body.qty } });
  const updated = await recompute(id);
  if (!updated) return notFound();
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id, itemId } = await params;

  const order = await db.order.findUnique({ where: { id } });
  if (!order) return notFound("Order not found");
  // Items can only be removed while the order is still in pre-fulfillment
  // stages (pending / confirmed). Once packed, the order is locked.
  if (
    order.status === "cancelled" ||
    order.status === "delivered" ||
    order.status === "packed" ||
    order.status === "out_for_delivery" ||
    order.status === "returned"
  ) {
    return err(
      "Items are locked once the order is packed. Only pending or confirmed orders can be modified.",
      400
    );
  }

  const item = await db.orderItem.findUnique({ where: { id: itemId } });
  if (!item || item.orderId !== id) return notFound("Item not found");

  await db.orderItem.delete({ where: { id: itemId } });
  const updated = await recompute(id);
  if (!updated) return notFound();
  return ok(updated);
}
