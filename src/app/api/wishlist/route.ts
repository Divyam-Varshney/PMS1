// ============================================================================
// File: src/app/api/wishlist/route.ts
// Purpose: Customer wishlist (favorites) — list, add. Uses WishlistItem table.
// Role: Powers the heart-icon toggle on product cards/details and the
//       "My Wishlist" view in the customer account area.
// ============================================================================

import { db } from "@/lib/db";
import { getCustomerFromRequest } from "@/lib/auth";
import { ok, unauthorized, parseBody } from "@/lib/api";

/** GET /api/wishlist — list the current customer's saved products. */
export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();
  const items = await db.wishlistItem.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          shortDescription: true,
          composition: true,
          mrp: true,
          sellingPrice: true,
          baseDiscountPct: true,
          maxDiscountPct: true,
          primaryImage: true,
          stock: true,
          prescriptionRequired: true,
          avgRating: true,
          reviewCount: true,
          brand: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  return ok({ items: items.map((i) => ({ ...i.product, wishedAt: i.createdAt })) });
}

/** POST /api/wishlist { productId } — add a product to wishlist (idempotent). */
export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();
  const body = await parseBody<{ productId: string }>(req);
  if (!body?.productId) return ok({ error: "productId required" }, 400);
  // verify product exists
  const product = await db.product.findUnique({ where: { id: body.productId } });
  if (!product) return ok({ error: "Product not found" }, 404);
  await db.wishlistItem.upsert({
    where: { customerId_productId: { customerId: customer.id, productId: body.productId } },
    update: {},
    create: { customerId: customer.id, productId: body.productId },
  });
  return ok({ wished: true, productId: body.productId });
}
