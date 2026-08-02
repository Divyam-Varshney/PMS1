// ============================================================================
// File: src/app/api/cart/remove/route.ts
// Purpose: Remove a product from the cart.
// Role: Called from CartView / CartSheet.
// ============================================================================

import { db } from "@/lib/db";
import { ok, unauthorized, parseBody } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { buildCartResponse } from "../_lib";

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to modify your cart");

  const body = await parseBody<{ productId: string }>(req);
  if (!body?.productId) return ok(await buildCartResponse(customer.id));

  const cart = await db.cart.findUnique({ where: { customerId: customer.id } });
  if (!cart) return ok(await buildCartResponse(customer.id));

  await db.cartItem.deleteMany({
    where: { cartId: cart.id, productId: body.productId },
  });

  return ok(await buildCartResponse(customer.id));
}
