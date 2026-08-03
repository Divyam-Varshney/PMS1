// ============================================================================
// File: src/app/api/reviews/route.ts
// Purpose: Customer-submitted product reviews.
//          GET  — list approved reviews for a product (public).
//          POST — authenticated customer submits a review (status=pending
//                 until admin approval).
// Role: Powers the reviews tab on ProductView + the admin Reviews moderation.
// ============================================================================

import { db } from "@/lib/db";
import { getCustomerFromRequest } from "@/lib/auth";
import { ok, unauthorized, parseBody, param } from "@/lib/api";

/** GET /api/reviews?productId=... — approved reviews for a product. */
export async function GET(req: Request) {
  const productId = param(req, "productId");
  if (!productId) return ok({ items: [] });
  const reviews = await db.review.findMany({
    where: { productId, status: "approved" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      authorName: true,
      rating: true,
      title: true,
      body: true,
      createdAt: true,
      // Admin reply fields — surfaced to the customer so they can see the
      // pharmacy's response below their review.
      adminReply: true,
      adminReplyAt: true,
      customer: { select: { id: true, name: true } },
    },
  });
  // Mark whether each review is from a verified buyer (has a delivered order
  // containing this product) — a powerful trust signal.
  const enriched = await Promise.all(
    reviews.map(async (r) => {
      let verifiedBuyer = false;
      if (r.customer) {
        const count = await db.orderItem.count({
          where: {
            productId,
            order: {
              customerId: r.customer.id,
              status: "delivered",
            },
          },
        });
        verifiedBuyer = count > 0;
      }
      return { ...r, verifiedBuyer };
    })
  );
  return ok({ items: enriched });
}

/** POST /api/reviews { productId, rating, title?, body? } — submit a review. */
export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to submit a review");
  const body = await parseBody<{
    productId: string;
    rating: number;
    title?: string;
    body?: string;
  }>(req);
  if (!body?.productId || !body.rating)
    return ok({ error: "productId and rating are required" }, 400);
  const rating = Math.max(1, Math.min(5, Math.round(body.rating)));
  const product = await db.product.findUnique({ where: { id: body.productId } });
  if (!product) return ok({ error: "Product not found" }, 404);
  // Prevent duplicate reviews by the same customer for the same product.
  const existing = await db.review.findFirst({
    where: { productId: body.productId, customerId: customer.id },
  });
  if (existing)
    return ok({ error: "You have already reviewed this product" }, 409);
  const review = await db.review.create({
    data: {
      productId: body.productId,
      customerId: customer.id,
      authorName: customer.name,
      rating,
      title: body.title?.trim() || null,
      body: body.body?.trim() || null,
      status: "pending",
    },
  });
  return ok(review, 201);
}
