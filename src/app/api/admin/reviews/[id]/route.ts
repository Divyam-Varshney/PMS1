// ============================================================================
// File: src/app/api/admin/reviews/[id]/route.ts
// Purpose: Approve / reject / delete a review, plus admin reply management.
//          PATCH accepts:
//            { status }                 → approve / reject / pending
//            { adminReply: string }     → set or update the admin reply
//            { adminReply: null }       → clear the admin reply
// ============================================================================

import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { ok, err, unauthorized, notFound, parseBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await parseBody<{
    status?: string;
    adminReply?: string | null;
  }>(req);

  if (!body) return err("Invalid request body");

  const existing = await db.review.findUnique({ where: { id } });
  if (!existing) return notFound();

  // ---- Status change (approve / reject / pending) -------------------------
  if (typeof body.status === "string") {
    if (!["approved", "rejected", "pending"].includes(body.status)) {
      return err("Invalid status", 400);
    }
    await db.review.update({ where: { id }, data: { status: body.status } });

    // Recompute product rating snapshot if approved/rejected
    const reviews = await db.review.findMany({
      where: { productId: existing.productId, status: "approved" },
      select: { rating: true },
    });
    if (reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await db.product.update({
        where: { id: existing.productId },
        data: { avgRating: Math.round(avg * 10) / 10, reviewCount: reviews.length },
      });
    } else {
      await db.product.update({
        where: { id: existing.productId },
        data: { avgRating: 0, reviewCount: 0 },
      });
    }
  }

  // ---- Admin reply management ---------------------------------------------
  // `adminReply: null` clears the reply; any non-empty string sets/updates it.
  // Empty string is treated as a clear as well (defensive — UI sends null).
  if (body.adminReply !== undefined) {
    const trimmed = body.adminReply?.trim() ?? "";
    if (trimmed.length === 0) {
      // Clear the reply.
      await db.review.update({
        where: { id },
        data: {
          adminReply: null,
          adminReplyAt: null,
          adminReplyBy: null,
        },
      });
    } else {
      // Set or update the reply. `adminReplyAt` is bumped on every edit so the
      // customer-side "Response from Pradeep Medical Store" timestamp reflects
      // the latest revision.
      await db.review.update({
        where: { id },
        data: {
          adminReply: trimmed,
          adminReplyAt: new Date(),
          adminReplyBy: admin.id,
        },
      });
    }
  }

  const updated = await db.review.findUnique({ where: { id } });
  return ok(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminFromRequest();
  if (!admin) return unauthorized();
  const { id } = await params;
  await db.review.delete({ where: { id } });
  return ok({ deleted: true });
}
