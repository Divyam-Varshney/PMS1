// ============================================================================
// File: src/app/api/cart/add/route.ts
// Purpose: Add a product to the customer's cart. Upserts the CartItem
//          (adds to existing quantity). Requires auth.
// Role: Called from ProductCard, ProductView, CartSheet.
// ============================================================================

import { db } from "@/lib/db";
import { ok, err, unauthorized, parseBody, notFound } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth";
import { buildCartResponse } from "../_lib";

export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to add items to your cart");

  const body = await parseBody<{ productId: string; qty?: number }>(req);
  if (!body?.productId) return err("productId is required");
  const qty = Math.max(1, Math.min(99, Math.floor(body.qty ?? 1)));

  // Fetch product + cart in parallel (2 queries → 1 round-trip window)
  const [product, existingCart] = await Promise.all([
    db.product.findFirst({
      where: { id: body.productId, status: "active", visibility: "public" },
      select: { id: true, stock: true, name: true },
    }),
    db.cart.findUnique({
      where: { customerId: customer.id },
      select: { id: true },
    }),
  ]);

  if (!product) return notFound("Product not found");

  // Block adding out-of-stock items (stock === 0) entirely.
  if (product.stock <= 0) {
    return err(`${product.name} is currently out of stock`, 400);
  }

  // Get or create the cart (only create if it doesn't exist)
  let cart = existingCart;
  if (!cart) {
    cart = await db.cart.create({ data: { customerId: customer.id }, select: { id: true } });
  }

  // Check existing item quantity in a single query (needed for stock validation)
  const existing = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: body.productId } },
    select: { id: true, quantity: true },
  });
  const newQty = (existing?.quantity ?? 0) + qty;

  // Block exceeding available stock.
  if (newQty > product.stock) {
    return err(`Only ${product.stock} units of ${product.name} are available`, 400);
  }

  // Single upsert instead of findUnique + update/create (saves 1 query)
  await db.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: body.productId } },
    create: { cartId: cart.id, productId: body.productId, quantity: qty },
    update: { quantity: newQty },
  });

  const updated = await buildCartResponse(customer.id);
  return ok(updated);
}
