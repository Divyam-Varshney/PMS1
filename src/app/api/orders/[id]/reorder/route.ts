// ============================================================================
// File: src/app/api/orders/[id]/reorder/route.ts
// Purpose: One-click "Buy Again" — re-adds all products from a past order to
//          the customer's cart (skips products no longer available / out of
//          stock). Returns the updated cart + a summary of what was added vs
//          skipped, so the UI can show a precise toast.
// Role: Powers the "Reorder" button on the customer OrdersView.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { buildCartResponse } from "@/app/api/cart/_lib";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to reorder");

  try {
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) return notFound("Order not found");
    if (order.customerId !== customer.id) return forbidden();

    let cart = await db.cart.findUnique({ where: { customerId: customer.id } });
    if (!cart) {
      cart = await db.cart.create({ data: { customerId: customer.id } });
    }

    const productIds = order.items
      .map((i) => i.productId)
      .filter((p): p is string => !!p);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, stock: true, name: true, status: true, visibility: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let added = 0;
    let skipped: string[] = [];
    for (const item of order.items) {
      if (!item.productId) { skipped.push(item.name); continue; }
      const product = productMap.get(item.productId);
      if (!product || product.status !== "active" || product.visibility !== "public") {
        skipped.push(item.name); continue;
      }
      if (product.stock <= 0) { skipped.push(item.name); continue; }
      const qty = Math.min(item.qty, product.stock);
      const existing = await db.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
      });
      if (existing) {
        await db.cartItem.update({
          where: { id: existing.id },
          data: { quantity: Math.min(existing.quantity + qty, product.stock) },
        });
      } else {
        await db.cartItem.create({
          data: { cartId: cart.id, productId: item.productId, quantity: qty },
        });
      }
      added++;
    }

    const updated = await buildCartResponse(customer.id);
    return ok({ cart: updated, added, skipped, totalItems: order.items.length });
  } catch (e: any) {
    console.error("[reorder] error:", e);
    return err("Reorder failed: " + (e?.message || "unknown error"), 500);
  }
}
