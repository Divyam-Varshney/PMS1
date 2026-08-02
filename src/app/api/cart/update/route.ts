// ============================================================================
// File: src/app/api/cart/update/route.ts
// Purpose: Set the quantity of a cart item (remove if qty <= 0).
// Role: Called from qty steppers in CartView / CartSheet.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { buildCartResponse } from "../_lib";

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to update your cart");

  const body = await parseBody<{ productId: string; qty: number }>(req);
  if (!body?.productId || typeof body.qty !== "number") {
    return err("productId and qty are required");
  }

  const cart = await db.cart.findUnique({ where: { customerId: customer.id } });
  if (!cart) return ok(await buildCartResponse(customer.id));

  const existing = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: body.productId } },
  });
  if (!existing) return ok(await buildCartResponse(customer.id));

  if (body.qty <= 0) {
    await db.cartItem.delete({ where: { id: existing.id } });
  } else {
    await db.cartItem.update({
      where: { id: existing.id },
      data: { quantity: Math.min(99, Math.floor(body.qty)) },
    });
  }

  return ok(await buildCartResponse(customer.id));
}
