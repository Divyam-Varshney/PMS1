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
import { aiChatCompletion } from "@/lib/ai-service";

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
      images: true,
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
      // Parse the JSON `images` field into an array of URLs. Defensive in case
      // the column is null / holds a non-JSON value (legacy rows).
      let imageUrls: string[] = [];
      if (r.images) {
        try {
          const parsed = JSON.parse(r.images);
          if (Array.isArray(parsed)) {
            imageUrls = parsed.filter((s) => typeof s === "string" && s.trim());
          }
        } catch {
          imageUrls = [];
        }
      }
      const { images: _images, ...rest } = r;
      return { ...rest, verifiedBuyer, images: imageUrls };
    })
  );
  return ok({ items: enriched });
}

/** POST /api/reviews { productId, rating, title?, body?, images? } — submit a review.
 *  The optional `images` array contains uploaded image URLs (e.g. uploaded via
 *  /api/file/reviews). After creating the review, an AI moderation pass runs
 *  (best-effort) to set the `aiStatus` field (auto_approved | flagged | manual). */
export async function POST(req: Request) {
  const customer = await getCustomerFromRequest();
  if (!customer) return unauthorized("Please login to submit a review");
  const body = await parseBody<{
    productId: string;
    rating: number;
    title?: string;
    body?: string;
    images?: string[];
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

  // Normalize the uploaded image URLs (max 6, dedupe, drop non-strings).
  const rawImages = Array.isArray(body.images) ? body.images : [];
  const imageUrls = Array.from(new Set(rawImages.filter((s) => typeof s === "string" && s.trim()))).slice(0, 6);
  const imagesJson = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null;

  const review = await db.review.create({
    data: {
      productId: body.productId,
      customerId: customer.id,
      authorName: customer.name,
      rating,
      title: body.title?.trim() || null,
      body: body.body?.trim() || null,
      images: imagesJson,
      status: "pending",
    },
  });

  // Best-effort AI moderation — runs after the row is created so a failure
  // never blocks the customer's submission. The admin can still manually
  // moderate from ReviewsView.
  try {
    const titleTrim = body.title?.trim() || "";
    const bodyTrim = body.body?.trim() || "";
    const prompt = `You are a content moderation AI for a pharmacy product review system. Decide whether the following review should be auto-approved or flagged for human review.

Return ONLY valid JSON:
{"status": "auto_approved" | "flag", "note": "short reason (max 120 chars)"}

Flag (status="flag") if the review:
- Contains promotional links, URLs, or contact info
- Contains abusive, hateful, or harassing language
- Is spam (e.g. repeated characters, irrelevant content, gibberish)
- Mentions competitor products by name with disparaging intent
- Contains personally identifiable information about others

Otherwise auto-approve (status="auto_approved").

Author: ${customer.name}
Rating: ${rating}/5
Title: ${titleTrim}
Body: ${bodyTrim}

Return ONLY the JSON.`;

    const result = await aiChatCompletion(
      [
        { role: "system", content: "You are a content moderation AI. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.2, max_tokens: 200 }
    );
    const text = result.content?.trim() || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const verdict = JSON.parse(m[0]);
        if (verdict?.status === "auto_approved" || verdict?.status === "flagged") {
          await db.review.update({
            where: { id: review.id },
            data: {
              aiStatus: verdict.status,
              aiNote: typeof verdict.note === "string" ? verdict.note.slice(0, 200) : null,
            },
          });
        } else if (verdict?.status === "flag") {
          await db.review.update({
            where: { id: review.id },
            data: {
              aiStatus: "flagged",
              aiNote: typeof verdict.note === "string" ? verdict.note.slice(0, 200) : null,
            },
          });
        }
      } catch {
        // Invalid JSON — leave aiStatus null (manual review)
      }
    }
  } catch (e) {
    // Silent — moderation is best-effort
    console.error("[reviews/POST] AI moderation failed:", e);
  }

  return ok(review, 201);
}
