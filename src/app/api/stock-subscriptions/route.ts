// ============================================================================
// File: src/app/api/stock-subscriptions/route.ts
// Purpose: Customer back-in-stock subscriptions.
//   POST   /api/stock-subscriptions            — subscribe to a product
//   GET    /api/stock-subscriptions            — list current customer's subs
//   DELETE /api/stock-subscriptions?productId=  — cancel a subscription
// Role: Powers the "Notify me when available" button on out-of-stock product
//       detail pages. The admin restock flow (products PATCH) checks for
//       active subscriptions and marks them "notified".
// ============================================================================

import { db } from "@/lib/db";
import { getCustomerFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, parseBody } from "@/lib/api";

/** GET /api/stock-subscriptions — list the current customer's subscriptions. */
export async function GET() {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();
  const subs = await db.stockSubscription.findMany({
    where: { customerId: customer.id, status: { in: ["active", "notified"] } },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          primaryImage: true,
          stock: true,
          sellingPrice: true,
          mrp: true,
          brand: { select: { name: true } },
        },
      },
    },
  });
  return ok({ items: subs });
}

/** POST /api/stock-subscriptions — subscribe to a product's restock alert. */
export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();
  const body = await parseBody<{ productId?: string }>(req);
  if (!body?.productId) return err("productId is required", 400);

  // Verify product exists
  const product = await db.product.findUnique({
    where: { id: body.productId },
    select: { id: true, name: true, stock: true, status: true },
  });
  if (!product) return err("Product not found", 404);

  // Upsert: if a subscription exists (any status), re-arm it to "active".
  const sub = await db.stockSubscription.upsert({
    where: {
      customerId_productId: {
        customerId: customer.id,
        productId: body.productId,
      },
    },
    create: {
      customerId: customer.id,
      productId: body.productId,
      email: customer.email,
      status: "active",
    },
    update: {
      status: "active",
      notifiedAt: null,
    },
  });

  return ok({ subscription: sub, message: "You'll be notified when this product is back in stock." });
}

/** DELETE /api/stock-subscriptions?productId=xxx — cancel a subscription. */
export async function DELETE(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized();
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  if (!productId) return err("productId is required", 400);

  await db.stockSubscription.updateMany({
    where: { customerId: customer.id, productId },
    data: { status: "cancelled" },
  });

  return ok({ message: "Subscription cancelled." });
}
